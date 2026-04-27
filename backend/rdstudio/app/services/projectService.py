from sqlalchemy.orm import Session

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

def delete_project(db:Session, project_id:int):
    project=db.query(Project).filter(Project.id == project_id).first()

    if project:
        db.delete(project)
        db.commit()