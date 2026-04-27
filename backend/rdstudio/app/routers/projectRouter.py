
from fastapi import APIRouter,HTTPException,Depends,status,UploadFile,File
from sqlalchemy.orm import Session
from typing import List

from app.schemas import projectSchema
from app.db.database import get_db
from app.services import projectService
from app.services import sowService

router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
)

@router.post('/')
def create_project(project: projectSchema.ProjectCreate, db : Session= Depends(get_db)):

    return projectService.create_project(db,project=project)

@router.get('/',response_model=List[projectSchema.ProjectResponse])
def  get_projects(skip: int=0,limit: int=100,db=Depends(get_db)):
    '''lists down all projects created'''
    return projectService.get_project(db,skip,limit);

@router.get('/{project_id}', response_model=projectSchema.ProjectResponse)
def get_project_by_id(project_id: int, db: Session = Depends(get_db)):
    project = projectService.get_project_by_id(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete('/{project_id}')
def delete_project(project_id:int,db:Session = Depends(get_db)):
    return projectService.delete_project(db,project_id=project_id)



