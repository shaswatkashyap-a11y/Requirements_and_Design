from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.services.artifactRepository import ArtifactRepository
from app.schemas.generationSchemas import (
    GenerationRequest,
    GenerationKickoffResponse,
    GenerationRunResponse,
)
from app.schemas.artifactSchemas import (
    ModuleResponse,
    ArtifactResponse,
    ArtifactSummaryResponse,
)
from app.tasks.generationTask import run_generation_pipeline
from app.config.artifact_type_defaults import resolve_artifact_types
from app.models.generationRun import GenerationRun
from app.models.module import Module
from app.models.artifact import Artifact
from app.models.sow import Sow

STALE_THRESHOLD_HOURS = 2
IN_PROGRESS_STATUSES = {"extracting_modules", "generating_artifacts", "queued", "pending"}
TERMINAL_STATUSES = {"completed", "failed"}

router = APIRouter(tags=["Generation"])


# ── Kick off generation ──

@router.post(
    "/projects/{project_id}/sows/{sow_id}/generations",
    response_model=GenerationKickoffResponse,
    status_code=202,
)
def start_generation(
    project_id: int,
    sow_id: int,
    request: GenerationRequest,
    db: Session = Depends(get_db),
):
    sow = db.query(Sow).filter(
        Sow.id == sow_id, Sow.project_id == project_id
    ).first()
    if not sow:
        raise HTTPException(404, "SOW not found for this project")

    # resolve artifact types — auto if not provided, user override if provided
    artifact_types = request.artifact_types or resolve_artifact_types(
        request.methodology, request.service_line_codes
    )

    repo = ArtifactRepository(db)
    run = repo.create_generation_run(
        project_id=project_id,
        sow_id=sow_id,
        methodology=request.methodology,
        service_line_codes=request.service_line_codes,
        artifact_types=artifact_types,
        config_snapshot={
            "methodology": request.methodology,
            "service_line_codes": request.service_line_codes,
            "artifact_types": artifact_types,
            "auto_resolved": request.artifact_types is None,
        },
    )

    run_generation_pipeline.delay(run.id)

    return GenerationKickoffResponse(
        generation_run_id=run.id,
        status="queued",
        message="Generation pipeline started. Poll status for progress.",
    )


# ── Poll status ──

def _mark_stale_if_needed(run: GenerationRun, db: Session) -> None:
    """Auto-fail a run that has been stuck in an in-progress status for > 2 hours."""
    if run.status not in IN_PROGRESS_STATUSES:
        return
    if not run.started_at:
        return
    started = run.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    age = datetime.now(timezone.utc) - started
    if age > timedelta(hours=STALE_THRESHOLD_HOURS):
        run.status = "failed"
        run.error_log = "Run timed out — exceeded maximum duration (2 hours)."
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)


@router.get(
    "/generations/{run_id}",
    response_model=GenerationRunResponse,
)
def get_generation_status(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Generation run not found")
    _mark_stale_if_needed(run, db)
    return run


# ── Cancel a run ──

@router.post(
    "/generations/{run_id}/cancel",
    response_model=GenerationRunResponse,
)
def cancel_generation_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Generation run not found")
    if run.status in TERMINAL_STATUSES:
        raise HTTPException(
            400, f"Cannot cancel a run that is already '{run.status}'."
        )
    run.status = "failed"
    run.error_log = "Cancelled by user."
    run.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(run)
    return run


# ── Delete a run (cascade deletes modules + artifacts) ──

@router.delete(
    "/generations/{run_id}",
    status_code=204,
)
def delete_generation_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Generation run not found")
    db.delete(run)
    db.commit()
    return Response(status_code=204)


# ── Get modules for a run ──

@router.get(
    "/generations/{run_id}/modules",
    response_model=list[ModuleResponse],
)
def get_modules(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Generation run not found")

    modules = (
        db.query(Module)
        .filter(Module.generation_run_id == run_id)
        .order_by(Module.module_order)
        .all()
    )

    # populate artifact_count for each module
    results = []
    for m in modules:
        count = db.query(Artifact).filter(Artifact.module_id == m.id).count()
        response = ModuleResponse.model_validate(m)
        response.artifact_count = count
        results.append(response)

    return results



# ── Get artifacts for a module ──

@router.get(
    "/generations/{run_id}/modules/{module_id}/artifacts",
    response_model=list[ArtifactResponse],
)
def get_artifacts(
    run_id: int,
    module_id: int,
    artifact_type: str | None = None,
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(
        Module.id == module_id, Module.generation_run_id == run_id
    ).first()
    if not module:
        raise HTTPException(404, "Module not found for this generation run")

    query = db.query(Artifact).filter(Artifact.module_id == module_id)
    if artifact_type:
        query = query.filter(Artifact.artifact_type == artifact_type)

    return query.order_by(Artifact.sort_order).all()



# ── Generation history for a project ──

@router.get(
    "/projects/{project_id}/generations",
    response_model=list[GenerationRunResponse],
)
def get_project_generations(project_id: int, db: Session = Depends(get_db)):
    runs = (
        db.query(GenerationRun)
        .filter(GenerationRun.project_id == project_id)
        .order_by(GenerationRun.created_at.desc())
        .all()
    )
    return runs

# ── Run validation for a completed generation run ──

@router.post("/generations/{run_id}/validate")
def run_validation_endpoint(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise HTTPException(404, "Generation run not found")
    if run.status != "completed":
        raise HTTPException(400, f"Run is '{run.status}' — validation requires a completed run")

    from scripts.validate_output import run_validation, score_label

    try:
        structure, traceability, mod_relevance, art_relevance, completeness, data = run_validation(run_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))

    module_map = {m.id: m.name for m in data["modules"]}
    for r in mod_relevance:
        r["module_name"] = module_map.get(r["module_id"], "")
    for r in art_relevance:
        r["module_name"] = module_map.get(r["module_id"], "")
    for r in completeness:
        r["module_name"] = module_map.get(r["module_id"], "")

    all_scores = (
        [r["score"] for r in mod_relevance]
        + [r["score"] for r in art_relevance]
        + [r["score"] for r in completeness]
    )
    overall = round(sum(all_scores) / len(all_scores), 2) if all_scores else 0.0

    return {
        "run_id": run_id,
        "structure": structure,
        "traceability": traceability,
        "module_relevance": mod_relevance,
        "artifact_relevance": art_relevance,
        "completeness": completeness,
        "overall_score": overall,
        "overall_label": score_label(overall),
    }
