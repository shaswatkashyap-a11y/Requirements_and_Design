import re
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.lldRun import LLDRun, LLDArtifact, LLDArtifactVersion
from app.models.project import Project
from app.models.sow import Sow
from app.services.lldOrchestrator import LLDOrchestrator
from app.schemas.lldSchemas import (
    LLDGenerateRequest,
    LLDArtifactUpdateRequest,
    RegenerateLLDSectionRequest,
    LLDKickoffResponse,
    LLDRunResponse,
    LLDArtifactResponse,
    LLDArtifactVersionResponse,
)
from app.tasks.lldTask import run_lld_pipeline

STALE_THRESHOLD_HOURS = 2
IN_PROGRESS_STATUSES = {"pending", "generating"}

router = APIRouter(tags=["LLD Studio"])


# ── Kick off LLD generation ───────────────────────────────────────────────────

@router.post(
    "/projects/{project_id}/lld/generate",
    response_model=LLDKickoffResponse,
    status_code=202,
)
def start_lld_generation(
    project_id: int,
    request: LLDGenerateRequest,
    db: Session = Depends(get_db),
):
    sow_id = request.sow_id
    if not sow_id:
        latest_sow = (
            db.query(Sow)
            .filter(Sow.project_id == project_id, Sow.status.in_(["parsed", "completed"]))
            .order_by(Sow.created_at.desc())
            .first()
        )
        if latest_sow:
            sow_id = latest_sow.id

    run = LLDRun(
        project_id=project_id,
        sow_id=sow_id,
        design_run_id=request.design_run_id,
        generation_run_id=request.generation_run_id,
        status="pending",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    run_lld_pipeline.delay(run.id)

    return LLDKickoffResponse(
        lld_run_id=run.id,
        status="queued",
        message="LLD generation started. Poll /api/lld/{run_id} for status.",
    )


# ── Poll status ───────────────────────────────────────────────────────────────

def _mark_stale_if_needed(run: LLDRun, db: Session) -> None:
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


@router.get("/lld/{run_id}", response_model=LLDRunResponse)
def get_lld_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(LLDRun).get(run_id)
    if not run:
        raise HTTPException(404, "LLD run not found")
    _mark_stale_if_needed(run, db)
    return run


@router.get("/projects/{project_id}/lld/latest", response_model=LLDRunResponse)
def get_project_latest_lld(project_id: int, db: Session = Depends(get_db)):
    run = (
        db.query(LLDRun)
        .filter(LLDRun.project_id == project_id)
        .order_by(LLDRun.created_at.desc())
        .first()
    )
    if not run:
        raise HTTPException(404, "No LLD run found for this project")
    _mark_stale_if_needed(run, db)
    return run


@router.get("/projects/{project_id}/lld", response_model=list[LLDRunResponse])
def get_project_lld_history(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(LLDRun)
        .filter(LLDRun.project_id == project_id)
        .order_by(LLDRun.created_at.desc())
        .all()
    )


# ── Artifacts ─────────────────────────────────────────────────────────────────

@router.get("/lld/{run_id}/artifacts", response_model=list[LLDArtifactResponse])
def get_lld_artifacts(run_id: int, db: Session = Depends(get_db)):
    run = db.query(LLDRun).get(run_id)
    if not run:
        raise HTTPException(404, "LLD run not found")
    return (
        db.query(LLDArtifact)
        .filter(LLDArtifact.lld_run_id == run_id)
        .order_by(LLDArtifact.sort_order)
        .all()
    )


@router.get("/lld/{run_id}/artifacts/{section_type}", response_model=LLDArtifactResponse)
def get_lld_artifact(run_id: int, section_type: str, db: Session = Depends(get_db)):
    artifact = (
        db.query(LLDArtifact)
        .filter(LLDArtifact.lld_run_id == run_id, LLDArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    return artifact


@router.patch("/lld/{run_id}/artifacts/{section_type}", response_model=LLDArtifactResponse)
def update_lld_artifact(
    run_id: int,
    section_type: str,
    body: LLDArtifactUpdateRequest,
    db: Session = Depends(get_db),
):
    artifact = (
        db.query(LLDArtifact)
        .filter(LLDArtifact.lld_run_id == run_id, LLDArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    db.add(LLDArtifactVersion(
        artifact_id=artifact.id,
        content_markdown=artifact.content_markdown,
        version_note="manually edited",
    ))
    artifact.content_markdown = body.content_markdown
    artifact.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(artifact)
    return artifact


@router.post("/lld/{run_id}/artifacts/{section_type}/regenerate", response_model=LLDArtifactResponse)
async def regenerate_lld_section(
    run_id: int,
    section_type: str,
    body: RegenerateLLDSectionRequest = RegenerateLLDSectionRequest(),
    db: Session = Depends(get_db),
):
    run = db.query(LLDRun).get(run_id)
    if not run:
        raise HTTPException(404, "LLD run not found")
    try:
        orchestrator = LLDOrchestrator(db)
        return await orchestrator.regenerate_section(run_id, section_type, body.instruction)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/lld/{run_id}/artifacts/{section_type}/versions", response_model=list[LLDArtifactVersionResponse])
def get_lld_section_versions(run_id: int, section_type: str, db: Session = Depends(get_db)):
    artifact = (
        db.query(LLDArtifact)
        .filter(LLDArtifact.lld_run_id == run_id, LLDArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    return (
        db.query(LLDArtifactVersion)
        .filter(LLDArtifactVersion.artifact_id == artifact.id)
        .order_by(LLDArtifactVersion.saved_at.desc())
        .all()
    )


@router.post("/lld/{run_id}/artifacts/{section_type}/restore/{version_id}", response_model=LLDArtifactResponse)
def restore_lld_section_version(
    run_id: int, section_type: str, version_id: int, db: Session = Depends(get_db)
):
    artifact = (
        db.query(LLDArtifact)
        .filter(LLDArtifact.lld_run_id == run_id, LLDArtifact.section_type == section_type)
        .first()
    )
    if not artifact:
        raise HTTPException(404, f"Section '{section_type}' not found")
    version = db.query(LLDArtifactVersion).get(version_id)
    if not version or version.artifact_id != artifact.id:
        raise HTTPException(404, "Version not found")
    db.add(LLDArtifactVersion(
        artifact_id=artifact.id,
        content_markdown=artifact.content_markdown,
        version_note="before restore",
    ))
    artifact.content_markdown = version.content_markdown
    artifact.created_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(artifact)
    return artifact


@router.delete("/lld/{run_id}", status_code=204)
def delete_lld_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(LLDRun).get(run_id)
    if not run:
        raise HTTPException(404, "LLD run not found")
    db.delete(run)
    db.commit()
    return Response(status_code=204)
