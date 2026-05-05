from pydantic import BaseModel
from datetime import datetime
from app.models.moduleVersion import ModuleVersionSource


class ModuleUpdateRequest(BaseModel):
    name:        str
    description: str | None = None


class ModuleRefineRequest(BaseModel):
    feedback: str


class ModuleVersionResponse(BaseModel):
    id:                  int
    version_number:      int
    name:                str
    description:         str | None
    refinement_feedback: str | None
    source:              ModuleVersionSource
    created_at:          datetime

    model_config = {"from_attributes": True}


class ModuleResponse(BaseModel):
    id:                 int
    name:               str
    description:        str | None
    module_order:       int
    current_version_id: int | None

    model_config = {"from_attributes": True}
