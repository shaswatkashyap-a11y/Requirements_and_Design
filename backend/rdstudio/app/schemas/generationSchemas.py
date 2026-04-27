from pydantic import BaseModel, Field
from datetime import datetime


# ── Request ──

class GenerationRequest(BaseModel):
    methodology: str = Field(..., examples=["scrum"])
    service_line_codes: list[str] = Field(..., examples=["react", "python_dev"])
    artifact_types: list[str] | None = Field(
        default=None,
        description="Optional override. If omitted, auto-resolved from methodology + service lines.",
        examples=["functional_req", "nonfunctional_req", "task"],
    )

    class Config:
        json_schema_extra = {
            "example": {
                "methodology": "scrum",
                "service_line_codes": ["react", "python_dev", "aws"],
                "artifact_types": [
                    "functional_req", "nonfunctional_req",
                    "task", "test_case", "architecture",
                ],
            }
        }


# ── Responses ──

class GenerationKickoffResponse(BaseModel):
    generation_run_id: int
    status: str
    message: str


class GenerationRunResponse(BaseModel):
    id: int
    project_id: int
    sow_id: int
    methodology: str
    service_line_codes: list[str]
    artifact_types_requested: list[str]
    status: str
    progress_message: str | None = None
    current_round: int | None = None
    total_rounds: int | None = None
    error_log: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True