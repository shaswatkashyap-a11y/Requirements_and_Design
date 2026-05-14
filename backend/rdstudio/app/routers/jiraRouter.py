import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.models.project import Project
from app.models.module import Module
from app.models.generationRun import GenerationRun
from app.services.jiraService import JiraService, jira_service_from_project

logger = logging.getLogger(__name__)
router = APIRouter(tags=["jira"])


# ── Request / Response schemas ────────────────────────────────────────────────

class JiraConfigPayload(BaseModel):
    jira_url:         str
    jira_project_key: str
    jira_user_email:  str
    jira_api_token:   str


class PushToJiraPayload(BaseModel):
    generation_run_id: int
    module_ids:        list[int]
    push_tasks:        bool = True
    push_nfrs:         bool = True
    create_nfr_epic:   bool = True   # group all NFRs under one shared Epic
    force_repush:      bool = False  # clear existing jira keys and re-push


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/projects/{project_id}/jira/config")
def save_jira_config(
    project_id: int,
    payload:    JiraConfigPayload,
    db:         Session = Depends(get_db),
):
    """Save (or update) Jira credentials for a project."""
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    url = payload.jira_url.strip().rstrip("/")
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url
    project.jira_url         = url
    project.jira_project_key = payload.jira_project_key.upper().strip()
    project.jira_user_email  = payload.jira_user_email.strip()
    project.jira_api_token   = payload.jira_api_token.strip()
    db.commit()
    return {"message": "Jira config saved"}


@router.post("/projects/{project_id}/jira/test")
def test_jira_connection(
    project_id: int,
    db:         Session = Depends(get_db),
):
    """Verify saved Jira credentials by hitting the Jira project endpoint."""
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    try:
        svc  = jira_service_from_project(project)
        info = svc.verify_connection()
        return {"success": True, "jira_project_name": info.get("name"), "key": info.get("key")}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(400, f"Connection failed: {e}")


@router.post("/projects/{project_id}/jira/push")
def push_to_jira(
    project_id: int,
    payload:    PushToJiraPayload,
    db:         Session = Depends(get_db),
):
    """
    Push selected modules from a generation run to Jira.
    Each module becomes an Epic; FRs become Stories; Tasks become Tasks.
    NFRs are grouped under a single shared 'Non-Functional Requirements' Epic.
    """
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        svc = jira_service_from_project(project)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Validate generation run belongs to this project
    run = db.query(GenerationRun).get(payload.generation_run_id)
    if not run or run.project_id != project_id:
        raise HTTPException(404, "Generation run not found")

    # Load requested modules (with their artifacts eager-loaded)
    modules = (
        db.query(Module)
        .filter(
            Module.id.in_(payload.module_ids),
            Module.generation_run_id == payload.generation_run_id,
        )
        .all()
    )
    if not modules:
        raise HTTPException(404, "No modules found with given IDs")

    results  = []
    all_errors = []

    # Create one shared NFR Epic for all modules if requested
    nfr_epic_key = None
    if payload.push_nfrs and payload.create_nfr_epic:
        try:
            from app.models.module import Module as ModuleModel
            nfr_module = ModuleModel(
                generation_run_id=payload.generation_run_id,
                name=f"Non-Functional Requirements — {project.name}",
                description="System-wide NFRs: performance, security, scalability, reliability.",
            )
            nfr_epic_key = svc.create_epic(nfr_module)
            logger.info(f"Created shared NFR Epic: {nfr_epic_key}")
        except Exception as e:
            logger.warning(f"Could not create NFR Epic: {e}")

    # Push each module
    for module in sorted(modules, key=lambda m: m.module_order):
        logger.info(f"Pushing module {module.id} ({module.name})")

        # Force re-push: clear stored Jira keys so everything is re-created
        if payload.force_repush:
            module.jira_epic_key = None
            for a in module.artifacts:
                a.jira_issue_key = None
            db.commit()

        result = svc.push_module(
            module        = module,
            db            = db,
            push_tasks    = payload.push_tasks,
            push_nfrs     = payload.push_nfrs,
            nfr_epic_key  = nfr_epic_key,
        )
        results.append({
            "module_id":   module.id,
            "module_name": module.name,
            **result,
        })
        all_errors.extend(result.get("errors", []))

    total_created = sum(
        len(r["stories"]) + len(r["tasks"]) + len(r.get("nfr_stories", [])) + (1 if r["epic_key"] else 0)
        for r in results
    )

    return {
        "jira_project": project.jira_project_key,
        "jira_url":     project.jira_url,
        "total_created": total_created,
        "nfr_epic_key": nfr_epic_key,
        "modules":      results,
        "errors":       all_errors,
    }


@router.get("/projects/{project_id}/jira/status")
def jira_push_status(
    project_id:        int,
    generation_run_id: int,
    db:                Session = Depends(get_db),
):
    """Return which modules/artifacts have already been pushed."""
    modules = (
        db.query(Module)
        .filter(Module.generation_run_id == generation_run_id)
        .all()
    )
    return [
        {
            "module_id":      m.id,
            "module_name":    m.name,
            "jira_epic_key":  m.jira_epic_key,
            "pushed":         m.jira_epic_key is not None,
            "artifact_count": len([a for a in m.artifacts if a.jira_issue_key]),
        }
        for m in modules
    ]


@router.get("/projects/{project_id}/jira/config")
def get_jira_config(
    project_id: int,
    db:         Session = Depends(get_db),
):
    """Return Jira config for a project (token masked)."""
    project = db.query(Project).get(project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return {
        "configured":      bool(project.jira_url and project.jira_api_token),
        "jira_url":        project.jira_url,
        "jira_project_key": project.jira_project_key,
        "jira_user_email": project.jira_user_email,
        "token_saved":     bool(project.jira_api_token),
    }
