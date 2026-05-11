import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.refinementSchemas import (
    RefineArtifactRequest,
    ManualEditRequest,
    ArtifactVersionResponse,
    ArtifactRefinedResponse,
)
from app.services.refinementService import RefinementService
from app.services.refinementOrchestrator import RefinementOrchestrator
from app.services.llmClient import LLMClient
from app.services.promptBuilder import PromptBuilder
from app.services.artifactRepository import ArtifactRepository

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Refinement"])

@router.post(
    "/generations/{run_id}/artifacts/{artifact_id}/refine",
    response_model=ArtifactRefinedResponse,
)
async def refine_artifact(
    run_id:      int,
    artifact_id: int,
    body:        RefineArtifactRequest,
    db:          Session           = Depends(get_db),
):
    orchestrator = RefinementOrchestrator(llm=LLMClient(), prompt_builder=PromptBuilder(db=db))
    svc = RefinementService(db=db, orchestrator=orchestrator)
    """
    Synchronous single-artifact refinement.

    Why synchronous (not Celery)?
    A single artifact refinement takes ~10-60s. The user is watching a spinner.
    Polling overhead is unnecessary for a single item — the HTTP response IS
    the completion signal. Celery is reserved for module-level refinements
    that generate many artifacts concurrently.
    """
    try:
        new_version = await svc.refine_artifact(
            artifact_id   = artifact_id,
            run_id        = run_id,
            feedback      = body.feedback,
            cascade_stale = body.cascade_stale,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        # Covers both "artifact not found" and "refinement already in progress" (409)
        if "already in progress" in str(e):
            raise HTTPException(status_code=409, detail=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Refinement failed for artifact {artifact_id}: {e}", exc_info=True)
        raise HTTPException(status_code=422, detail=f"Refinement failed: {e}")

    # Count stale artifacts for the UI info message.
    # Re-fetch the artifact after the service updated it to get the right state.
    repo       = ArtifactRepository(db)
    artifact   = repo.get_artifact_with_version(artifact_id)
    downstream = repo.get_downstream_artifacts(artifact)
    stale_count= sum(
        1 for d in downstream
        if d.stale_status.value == "stale"
    )

    return ArtifactRefinedResponse(
        artifact_id = artifact_id,
        new_version = ArtifactVersionResponse.model_validate(new_version),
        stale_count = stale_count,
    )

@router.patch(
    "/generations/{run_id}/artifacts/{artifact_id}",
    response_model=ArtifactVersionResponse,
)
def manual_edit_artifact(
    run_id:      int,
    artifact_id: int,
    body:        ManualEditRequest,
    db:          Session = Depends(get_db),
):
    orchestrator = RefinementOrchestrator(llm=LLMClient(), prompt_builder=PromptBuilder(db=db))
    svc = RefinementService(db=db, orchestrator=orchestrator)
    """
    Save a manual edit as a new version (source=manual).
    Synchronous — no LLM call, responds immediately.
    """
    try:
        version = svc.save_manual_edit(
            artifact_id      = artifact_id,
            run_id           = run_id,
            content_markdown = body.content_markdown,
            content_json     = body.content_json,
        )
        return ArtifactVersionResponse.model_validate(version)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
@router.get(
    "/generations/{run_id}/artifacts/{artifact_id}/history",
    response_model=list[ArtifactVersionResponse],
)
def get_artifact_history(
    run_id:      int,
    artifact_id: int,
    db:          Session = Depends(get_db),
):
    """
    Return all versions for an artifact, newest first.
    Used to populate the version history drawer in the UI.
    """
    repo = ArtifactRepository(db)
    return repo.get_version_history(artifact_id)

@router.post(
    "/generations/{run_id}/artifacts/{artifact_id}/dismiss-stale",
    status_code=204,
)
def dismiss_stale(
    artifact_id: int,
    run_id:      int,
    db:          Session = Depends(get_db),
):
    """
    Acknowledge a stale warning without re-generating.
    Sets stale_status = 'stale_acknowledged' so the banner disappears
    but the history shows the user consciously chose not to re-generate.
    """
    repo = ArtifactRepository(db)
    repo.acknowledge_stale(artifact_id)
    return Response(status_code=204)