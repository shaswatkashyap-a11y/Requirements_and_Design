from pydantic import BaseModel, Field
from datetime import datetime
from typing import Any

class RefineArtifactRequest(BaseModel):
    feedback:      str  = Field(..., min_length=5, max_length=500)
    cascade_stale: bool = Field(True, description="Flag downstream artifacts as stale after refinement")

class ManualEditRequest(BaseModel):
    content_markdown: str
    content_json:     dict[str, Any]

class ArtifactVersionResponse(BaseModel):
    id:                  int
    artifact_id:         int
    version_number:      int
    content_markdown:    str | None
    content_json:        dict | None
    refinement_feedback: str | None
    source:              str
    llm_metadata:        dict | None
    created_at:          datetime

    model_config = {"from_attributes": True}

class ArtifactRefinedResponse(BaseModel):
    artifact_id:  int
    new_version:  ArtifactVersionResponse
    # How many downstream artifacts were marked stale.
    # Shown in the UI as "2 downstream artifacts may need updating."
    stale_count:  int