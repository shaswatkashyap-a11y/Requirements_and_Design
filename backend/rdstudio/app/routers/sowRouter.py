from fastapi import APIRouter, UploadFile, File, Depends, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.db.database import get_db
from app.services import sowService
from app.schemas.sowSchema import (
    SOWUploadResponse,
    SOWDetailResponse,
    SOWParseResponse,
    SectionResponse,
    TableResponse,
)

router = APIRouter(
    prefix="/projects/{project_id}/sow",
    tags=["SOW"],
)


@router.get("", response_model=SOWUploadResponse)
def get_latest_sow(
    project_id: int,
    db: Session = Depends(get_db),
):
    """Get the latest SOW for a project (lightweight — no sections/tables)."""
    sow = sowService.get_project_latest_sow(project_id=project_id, db=db)
    if not sow:
        return Response(status_code=204)
    return sow


@router.post("/upload", response_model=SOWUploadResponse)
def upload_sow(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a SOW file (PDF/DOCX). Does NOT parse yet."""
    return sowService.upload_sow(file=file, db=db, project_id=project_id)


@router.post("/{sow_id}/parse", response_model=SOWParseResponse)
def parse_sow(
    project_id: int,
    sow_id: int,
    db: Session = Depends(get_db),
):
    """Run parsing + classification on an uploaded SOW."""
    db_sow = sowService.parse_sow(sow_id=sow_id, db=db)
    return SOWParseResponse(
        id=db_sow.id,
        filename=db_sow.filename,
        status=db_sow.status,
        metadata_json=db_sow.metadata_json,
        sections_count=len(db_sow.sections),
        tables_count=len(db_sow.tables),
    )


@router.get("/{sow_id}", response_model=SOWDetailResponse)
def get_sow(
    project_id: int,
    sow_id: int,
    db: Session = Depends(get_db),
):
    """Get full SOW with all sections and tables."""
    return sowService.get_sow(sow_id=sow_id, db=db)


@router.get("/{sow_id}/sections", response_model=list[SectionResponse])
def get_sections(
    project_id: int,
    sow_id: int,
    section_type: Optional[str] = Query(None, description="Filter by type, e.g. 'scope', 'requirements'"),
    db: Session = Depends(get_db),
):
    """
    Get sections for a SOW.
    Optionally filter by section_type to get targeted content for LLM.
    Example: /projects/1/sow/1/sections?section_type=requirements
    """
    return sowService.get_sow_sections(
        sow_id=sow_id, db=db, section_type=section_type,
    )


@router.get("/{sow_id}/tables", response_model=list[TableResponse])
def get_tables(
    project_id: int,
    sow_id: int,
    db: Session = Depends(get_db),
):
    """Get all extracted tables for a SOW."""
    return sowService.get_sow_tables(sow_id=sow_id, db=db)