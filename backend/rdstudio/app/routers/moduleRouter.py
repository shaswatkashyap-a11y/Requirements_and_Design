import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.generationRun import GenerationRun
from app.models.moduleVersion import ModuleVersionSource
from app.schemas.moduleSchemas import (
    ModuleUpdateRequest, ModuleRefineRequest,
    ModuleVersionResponse, ModuleResponse,
)
from app.services.moduleRepository import ModuleRepository
from app.services.moduleRefinementService import ModuleRefinementService
from app.services.moduleRegenerationService import ModuleRegenerationService
from app.services.artifactRepository import ArtifactRepository

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Modules"])

@router.patch("/generations/{run_id}/modules/{module_id}", response_model=ModuleResponse)
def update_module(
    run_id:    int,
    module_id: int,
    body:      ModuleUpdateRequest,
    db:        Session = Depends(get_db),
):
    """Manual edit — update name/description and record a MANUAL version."""
    repo   = ModuleRepository(db)
    try:
        module = repo.get_by_run(run_id, module_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    repo.update(module_id, body.name, body.description)
    repo.append_version(
        module_id   = module_id,
        name        = body.name,
        description = body.description,
        source      = ModuleVersionSource.MANUAL,
    )
    repo.mark_all_artifacts_stale(module_id)
    db.refresh(module)
    return module


@router.post("/generations/{run_id}/modules/{module_id}/refine", response_model=ModuleResponse)
async def refine_module(
    run_id:    int,
    module_id: int,
    body:      ModuleRefineRequest,
    db:        Session = Depends(get_db),
):
    """AI refinement — send feedback to LLM, update module, record a REFINED version."""
    repo = ModuleRepository(db)
    run = db.query(GenerationRun).get(run_id)
    try:
        module = repo.get_by_run(run_id, module_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    if not run:
        raise HTTPException(status_code=404, detail="GenerationRun not found")

    artifact_repo = ArtifactRepository(db)
    sections      = artifact_repo.get_sow_sections(run.sow_id)
    sow_text      = "\n\n".join(
        f"[{s['section_type']}] {s['title']}\n{s['content'][:400]}"
        for s in sections
    )

    try:
        new_name, new_description, llm_meta = await ModuleRefinementService(db=db, project_id=run.project_id).refine(
            current_name        = module.name,
            current_description = module.description or "",
            sow_sections_text   = sow_text,
            feedback            = body.feedback,
            methodology         = run.methodology,
            service_line_codes  = run.service_line_codes or [],
        )
    except Exception as e:
        logger.exception(f"Module refinement LLM error: {e}")
        raise HTTPException(status_code=502, detail="LLM refinement failed")

    repo.update(module_id, new_name, new_description)
    repo.append_version(
        module_id           = module_id,
        name                = new_name,
        description         = new_description,
        source              = ModuleVersionSource.REFINED,
        refinement_feedback = body.feedback,
        llm_metadata        = llm_meta,
    )
    repo.mark_all_artifacts_stale(module_id)
    db.refresh(module)
    return module


@router.post("/generations/{run_id}/modules/{module_id}/regenerate", response_model=ModuleResponse)
async def regenerate_module_artifacts(
    run_id:    int,
    module_id: int,
    db:        Session = Depends(get_db),
):
    """Regenerate all artifacts for a module, preserving their version histories."""
    repo = ModuleRepository(db)
    try:
        module = repo.get_by_run(run_id, module_id)
        await ModuleRegenerationService().regenerate(module_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception(f"Module regeneration failed: {e}")
        raise HTTPException(status_code=502, detail="Regeneration failed")
    db.refresh(module)
    return module


@router.get("/generations/{run_id}/modules/{module_id}/versions", response_model=list[ModuleVersionResponse])
def get_module_versions(
    run_id:    int,
    module_id: int,
    db:        Session = Depends(get_db),
):
    repo = ModuleRepository(db)
    try:
        module = repo.get_by_run(run_id, module_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return repo.get_versions(module_id)
