from pydantic import BaseModel
from datetime import datetime
from typing import Optional


# ── Section ──────────────────────────────────────────────────

class SectionResponse(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    level: int
    section_order: int
    section_type: str
    confidence: float
    page_number: Optional[int] = None

    class Config:
        from_attributes = True


# ── Table ────────────────────────────────────────────────────

class TableResponse(BaseModel):
    id: int
    headers: list
    rows: list
    num_rows: int
    parent_section: Optional[str] = None
    table_order: int

    class Config:
        from_attributes = True


# ── SOW ──────────────────────────────────────────────────────

class SOWUploadResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class SOWDetailResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    status: str
    metadata_json: Optional[dict] = None
    raw_text: Optional[str] = None
    markdown_text: Optional[str] = None
    sections: list[SectionResponse] = []
    tables: list[TableResponse] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SOWParseResponse(BaseModel):
    id: int
    filename: str
    status: str
    metadata_json: Optional[dict] = None
    sections_count: int
    tables_count: int

    class Config:
        from_attributes = True