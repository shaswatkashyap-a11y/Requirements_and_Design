from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProjectBase(BaseModel):
    name:str
    description:Optional[str]
    client_name:Optional[str]
    engagement_model:Optional[str]
    methodology:Optional[str]
    service_line:Optional[str]
    project_type:     Optional[str] = None
    jira_url:         Optional[str] = None
    jira_project_key: Optional[str] = None
    jira_user_email:  Optional[str] = None
    jira_api_token:   Optional[str] = None


class ProjectCreate(ProjectBase):
    pass 

class ProjectResponse(ProjectBase):
    id:int
    created_at:datetime
    updated_at:Optional[datetime]

    class config:
        from_attributes=True