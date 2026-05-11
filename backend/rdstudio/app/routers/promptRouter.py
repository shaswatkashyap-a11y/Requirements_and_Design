import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas.promptSchemas import (
    PromptTemplateResponse,
    PromptUpdateRequest,
    ProjectOverrideRequest,
    ProjectActionRequest,
)
from app.services.promptRepository import PromptRepository

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Prompts"])


def _get_repo(db: Session = Depends(get_db)) -> PromptRepository:
    return PromptRepository(db)

@router.get("/prompts", response_model=list[PromptTemplateResponse])
def list_prompts(
    project_id: int | None = None,
    repo: PromptRepository = Depends(_get_repo),
):
    return repo.get_all(project_id=project_id)


@router.get("/prompts/{id}", response_model=PromptTemplateResponse)
def get_prompt(id: int, repo: PromptRepository = Depends(_get_repo)):
    row = repo.get_by_id(id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return row


@router.put("/prompts/{id}", response_model=PromptTemplateResponse)
def update_prompt(
    id:   int,
    body: PromptUpdateRequest,
    repo: PromptRepository = Depends(_get_repo),
):
    """Direct content update — for editing project-specific rows or global rows on admin page."""
    row = repo.get_by_id(id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    concept_key = row.scope_key or row.artifact_type
    repo._validate_xml(body.content, row.prompt_type, concept_key)
    return repo.update_content(id, body.content)


@router.post("/prompts/{id}/reset", status_code=204)
def reset_prompt(id: int, repo: PromptRepository = Depends(_get_repo)):
    """Soft delete — sets is_active=False."""
    row = repo.get_by_id(id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    repo.deactivate(id)


@router.post("/prompts/{id}/save-version", response_model=PromptTemplateResponse)
def save_project_version(
    id:   int,
    body: ProjectOverrideRequest,
    repo: PromptRepository = Depends(_get_repo),
):
    """
    Save edited content as a project-specific version (inactive by default).
    The global row is untouched. User clicks Override on the new row to activate it.
    """
    row = repo.get_by_id(id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    concept_key = row.scope_key or row.artifact_type
    repo._validate_xml(body.content, row.prompt_type, concept_key)
    try:
        return repo.save_project_version(id, body.project_id, body.content)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/prompts/{id}/activate", response_model=PromptTemplateResponse)
def activate_prompt(
    id:   int,
    repo: PromptRepository = Depends(_get_repo),
):
    """Override on a project-specific row: activate it so the orchestrator uses it."""
    row = repo.activate(id)
    if not row:
        raise HTTPException(status_code=404, detail="Prompt not found")
    return row


@router.post("/prompts/{id}/deactivate-override", status_code=204)
def deactivate_project_override(
    id:   int,
    body: ProjectActionRequest,
    repo: PromptRepository = Depends(_get_repo),
):
    """Override on a global row: deactivate project-specific row, revert to global fallback."""
    repo.deactivate_project_override(id, body.project_id)
