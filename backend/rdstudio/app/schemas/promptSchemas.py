from pydantic import BaseModel, Field
from datetime import datetime


class PromptTemplateResponse(BaseModel):
    id:            int
    prompt_type:   str
    artifact_type: str | None
    scope_key:     str | None
    section:       str
    content:       str
    is_active:     bool
    project_id:    int | None
    updated_at:    datetime

    model_config = {"from_attributes": True}


class PromptUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1)


class PromptPreviewRequest(BaseModel):
    artifact_type:       str
    methodology:         str
    service_line_codes:  list[str] = []
    sample_content_json: dict | None = None
    sample_feedback:     str = "Improve this artifact"


class ProjectOverrideRequest(BaseModel):
    project_id: int
    content:    str

# Used by activate and deactivate-override endpoints that only need a project_id
class ProjectActionRequest(BaseModel):
    project_id: int