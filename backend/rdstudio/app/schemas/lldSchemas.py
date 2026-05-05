from pydantic import BaseModel
from datetime import datetime


# ── Requests ──────────────────────────────────────────────────────────────────

class LLDGenerateRequest(BaseModel):
    sow_id: int | None = None
    design_run_id: int | None = None       # link to HLD run for context
    generation_run_id: int | None = None   # link to requirements run for FR/NFR context


class LLDArtifactUpdateRequest(BaseModel):
    content_markdown: str


class RegenerateLLDSectionRequest(BaseModel):
    instruction: str | None = None


# ── Responses ─────────────────────────────────────────────────────────────────

class LLDArtifactResponse(BaseModel):
    id: int
    section_type: str
    content_markdown: str
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class LLDRunResponse(BaseModel):
    id: int
    project_id: int
    sow_id: int | None = None
    design_run_id: int | None = None
    generation_run_id: int | None = None
    status: str
    progress_message: str | None = None
    error_log: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    artifacts: list[LLDArtifactResponse] = []

    class Config:
        from_attributes = True


class LLDArtifactVersionResponse(BaseModel):
    id: int
    artifact_id: int
    content_markdown: str
    version_note: str | None = None
    saved_at: datetime

    class Config:
        from_attributes = True


class LLDKickoffResponse(BaseModel):
    lld_run_id: int
    status: str
    message: str
