import re
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.designRun import DesignRun, DesignArtifact, DesignArtifactVersion
from app.models.project import Project
from app.models.sow import Sow
from app.services.hldOrchestrator import HLDOrchestrator
from app.services.docxExporter import build_hld_docx
from app.schemas.designSchemas import (
    DesignGenerateRequest,
    DesignArtifactUpdateRequest,
    RegenerateSectionRequest,
    DesignKickoffResponse,
    DesignRunResponse,
    DesignArtifactResponse,
    DesignArtifactVersionResponse,
)
from app.tasks.hldTask import run_hld_pipeline

STALE_THRESHOLD_HOURS = 2
IN_PROGRESS_STATUSES = {"pending", "generating"}
TERMINAL_STATUSES = {"completed", "failed"}

router = APIRouter(tags=["Design Studio"])


# ── Kick off HLD generation ───────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/design/generate",
    response_model=DesignKickoffResponse,
    status_code=202,
)
def start_hld_generation(
    project_id: int,
    request: DesignGenerateRequest,
    db: Session = Depends(get_db),
):
    sow_id = request.sow_id

    # if no sow_id given, use the latest parsed SOW for this project
    if not sow_id:
        latest_sow = (
            db.query(Sow)
            .filter(Sow.project_id == project_id, Sow.status.in_(["parsed", "completed"]))
            .order_by(Sow.created_at.desc())
            .first()
        )
        if latest_sow:
            sow_id = latest_sow.id

    run = DesignRun(
        project_id=project_id,
        sow_id=sow_id,
        generation_run_id=request.generation_run_id,
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run_hld_pipeline.delay(run.id)

    return DesignKickoffResponse(
        design_run_id=run.id,
        status="queued",
        message="HLD generation started. Poll /api/design/{run_id} for status.",
    )


# ── Poll status ───────────────────────────────────────────────────────────────

def _mark_stale_if_needed(run: DesignRun, db: Session) -> None:
    if run.status not in IN_PROGRESS_STATUSES or not run.started_at:
        return
    started = run.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) - started > timedelta(hours=STALE_THRESHOLD_HOURS):
        run.status = "failed"
        run.error_log = "Run timed out — exceeded maximum duration (2 hours)."
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)


@router.get("/design/{run_id}", response_model=DesignRunResponse)
def get_design_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(DesignRun).get(run_id)
    if not run:
        raise HTTPException(404, "Design run not found")
    _mark_stale_if_needed(run, db)
    return run


# ── Get latest design run for a project ──────────────────────────────────────

@router.get("/projects/{project_id}/design/latest", response_model=DesignRunResponse)
def get_project_latest_design(project_id: int, db: Session = Depends(get_db)):
    run = (
        db.query(DesignRun)
        .filter(DesignRun.project_id == project_id)
        .order_by(DesignRun.created_at.desc())
        .first()
    )
    if not run:
        raise HTTPException(404, "No design run found for this project")
    _mark_stale_if_needed(run, db)
    return run


# ── Get design run history for a project ─────────────────────────────────────

@router.get("/projects/{project_id}/design", response_model=list[DesignRunResponse])
def get_project_design_history(project_id: int, db: Session = Depends(get_db)):
    runs = (
        db.query(DesignRun)
        .filter(DesignRun.project_id == project_id)
        .order_by(DesignRun.created_at.desc())
        .all()
    )
    return runs


# ── Get artifacts for a design run ───────────────────────────────────────────

@router.get("/design/{run_id}/artifacts", response_model=list[DesignArtifactResponse])
def get_design_artifacts(run_id: int, db: Session = Depends(get_db)):
    run = db.query(DesignRun).get(run_id)
    if not run:
        raise HTTPException(404, "Design run not found")
    return (
        db.query(DesignArtifact)
        .filter(DesignArtifact.design_run_id == run_id)
        .order_by(DesignArtifact.sort_order)
        .all()
    )


@router.get("/design/{run_id}/artifacts/{section_type}", response_model=DesignArtifactResponse)
def get_design_artifact_by_section(run_id: int, section_type: str, db: Session = Depends(get_db)):
    artifact = (
        db.query(DesignArtifact)
        .filter(
            DesignArtifact.design_run_id == run_id,
            DesignArtifact.section_type == section_type,
        )
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found in this design run")
    return artifact


# ── Manually edit a section ──────────────────────────────────────────────────

@router.patch(
    "/design/{run_id}/artifacts/{section_type}",
    response_model=DesignArtifactResponse,
)
def update_design_artifact(
    run_id: int,
    section_type: str,
    body: DesignArtifactUpdateRequest,
    db: Session = Depends(get_db),
):
    artifact = (
        db.query(DesignArtifact)
        .filter(
            DesignArtifact.design_run_id == run_id,
            DesignArtifact.section_type == section_type,
        )
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found in this design run")
    # save current content as version before overwriting
    db.add(DesignArtifactVersion(
        artifact_id=artifact.id,
        content_markdown=artifact.content_markdown,
        version_note="manually edited",
    ))
    artifact.content_markdown = body.content_markdown
    artifact.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(artifact)
    return artifact


# ── Regenerate a single section ──────────────────────────────────────────────

@router.post(
    "/design/{run_id}/artifacts/{section_type}/regenerate",
    response_model=DesignArtifactResponse,
)
async def regenerate_section(
    run_id: int,
    section_type: str,
    body: RegenerateSectionRequest = RegenerateSectionRequest(),
    db: Session = Depends(get_db),
):
    run = db.query(DesignRun).get(run_id)
    if not run:
        raise HTTPException(404, "Design run not found")
    try:
        orchestrator = HLDOrchestrator(db)
        artifact = await orchestrator.regenerate_section(run_id, section_type, body.instruction)
        return artifact
    except ValueError as e:
        raise HTTPException(400, str(e))


# ── Version history for a section ───────────────────────────────────────────

@router.get(
    "/design/{run_id}/artifacts/{section_type}/versions",
    response_model=list[DesignArtifactVersionResponse],
)
def get_section_versions(run_id: int, section_type: str, db: Session = Depends(get_db)):
    artifact = (
        db.query(DesignArtifact)
        .filter(DesignArtifact.design_run_id == run_id, DesignArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    return (
        db.query(DesignArtifactVersion)
        .filter(DesignArtifactVersion.artifact_id == artifact.id)
        .order_by(DesignArtifactVersion.saved_at.desc())
        .all()
    )


@router.post(
    "/design/{run_id}/artifacts/{section_type}/restore/{version_id}",
    response_model=DesignArtifactResponse,
)
def restore_section_version(
    run_id: int, section_type: str, version_id: int, db: Session = Depends(get_db)
):
    artifact = (
        db.query(DesignArtifact)
        .filter(DesignArtifact.design_run_id == run_id, DesignArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    version = db.query(DesignArtifactVersion).get(version_id)
    if not version or version.artifact_id != artifact.id:
        raise HTTPException(404, "Version not found")
    # save current as version before restoring
    db.add(DesignArtifactVersion(
        artifact_id=artifact.id,
        content_markdown=artifact.content_markdown,
        version_note="before restore",
    ))
    artifact.content_markdown = version.content_markdown
    artifact.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(artifact)
    return artifact


# ── Export HLD as Word document ───────────────────────────────────────────────

@router.get("/design/{run_id}/export/docx")
def export_design_docx(run_id: int, db: Session = Depends(get_db)):
    run = db.query(DesignRun).get(run_id)
    if not run:
        raise HTTPException(404, "Design run not found")
    if run.status != "completed":
        raise HTTPException(400, "Design run is not completed yet")

    artifacts = (
        db.query(DesignArtifact)
        .filter(DesignArtifact.design_run_id == run_id)
        .order_by(DesignArtifact.sort_order)
        .all()
    )
    project = db.query(Project).get(run.project_id)

    buf = build_hld_docx(run, artifacts, project)

    safe_name = re.sub(r"[^\w\-]", "_", project.name)
    filename = f"HLD_{safe_name}_run{run_id}.docx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Delete a design run ───────────────────────────────────────────────────────

@router.delete("/design/{run_id}", status_code=204)
def delete_design_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(DesignRun).get(run_id)
    if not run:
        raise HTTPException(404, "Design run not found")
    db.delete(run)
    db.commit()
    return Response(status_code=204)
