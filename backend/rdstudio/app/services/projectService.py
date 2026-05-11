from sqlalchemy.orm import Session
from app.models.generationRun import GenerationRun
from app.models.module import Module
from app.models.artifact import Artifact
from app.models.artifactVersion import ArtifactVersion
from app.models.moduleVersion import ModuleVersion
from app.models.project import Project
from app.schemas import projectSchema

def create_project(db:Session,project:projectSchema.ProjectCreate): 
    project_data=project.model_dump()

    db_project=Project(**project_data)

    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def get_project(db:Session, skip: int=0, limit: int=100):
    return db.query(Project).offset(skip).limit(limit).all()

def get_project_by_id(db:Session, project_id:int):
    return db.query(Project).filter(Project.id == project_id).first()

def delete_project(db: Session, project_id: int):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return None

    # Step 1 — collect all IDs under this project
    run_ids = [
        r.id for r in db.query(GenerationRun)
        .filter(GenerationRun.project_id == project_id).all()
    ]
    module_ids = [
        m.id for m in db.query(Module)
        .filter(Module.generation_run_id.in_(run_ids)).all()
    ] if run_ids else []

    artifact_ids = [
        a.id for a in db.query(Artifact)
        .filter(Artifact.module_id.in_(module_ids)).all()
    ] if module_ids else []

    # Step 2 — break artifact circular FK, delete artifact_versions
    if artifact_ids:
        db.query(Artifact).filter(Artifact.id.in_(artifact_ids)).update(
            {"current_version_id": None}, synchronize_session=False
        )
        db.flush()
        db.query(ArtifactVersion).filter(ArtifactVersion.artifact_id.in_(artifact_ids)).delete(
            synchronize_session=False
        )
        db.flush()

    # Step 3 — break module circular FK, delete module_versions
    if module_ids:
        db.query(Module).filter(Module.id.in_(module_ids)).update(
            {"current_version_id": None}, synchronize_session=False
        )
        db.flush()
        db.query(ModuleVersion).filter(ModuleVersion.module_id.in_(module_ids)).delete(
            synchronize_session=False
        )
        db.flush()

    # Step 4 — cascade handles the rest
    db.delete(project)
    db.commit()