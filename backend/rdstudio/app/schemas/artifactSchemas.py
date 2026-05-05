from pydantic import BaseModel


class ModuleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    source_section_ids: list[int] | None
    module_order: int
    artifact_count: int = 0

    class Config:
        from_attributes = True


class ArtifactResponse(BaseModel):
    id: int
    artifact_type: str
    title: str
    content_json: dict
    content_markdown: str | None
    methodology_format: str | None
    parent_artifact_id: int | None
    sort_order: int
    confidence: float | None
    source_section_ids: list[int] | None
    stale_status:       str       = "current"
    current_version_id: int | None = None

    class Config:
        from_attributes = True


class ArtifactSummaryResponse(BaseModel):
    """Lighter response for list views — no full content."""
    id: int
    artifact_type: str
    title: str
    methodology_format: str | None
    sort_order: int
    confidence: float | None

    class Config:
        from_attributes = True

