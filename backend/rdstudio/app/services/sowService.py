import os
import shutil
import logging
from sqlalchemy.orm import Session
from fastapi import UploadFile,status

from app.models.project import Project
from app.models.sow import Sow,SOWSection,SOWStatus,SOWTable
from app.services.sowParser import SOWParser,ParsedSOW
from app.services.sectionClassifier import SectionClassifier

logger=logging.getLogger(__name__)

#----- Initialization --------------------------------------
_classifier = SectionClassifier()
_parser = SOWParser(classifier=_classifier)

UPLOAD_DIR="uploads"
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc"}

def upload_sow(file: UploadFile, db: Session, project_id: int):

    """Save file to disk and create a Sow record with status=uploaded."""

    project=db.query(Project).filter(Project.id==project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="PROJECT NOT FOUND")
    
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="ABEY FILE KA NAAM KAUN DEGA")
    
    # validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {ext}. Allowed: {ALLOWED_EXTENSIONS}",
        )
    
    filename=os.path.basename(file.filename)
    file_location=f"uploads/project_{project_id}_sow_{file.filename}"

    os.makedirs("uploads", exist_ok=True)

    try:
        with open(file_location,"wb+") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"Error Uploading the SOW file {str(e)}")
    finally:
            file.file.close()   

    db_sow=Sow(
        project_id=project_id,
        path_or_url=file_location,
        filename=filename,
        status=SOWStatus.UPLOADED,)

    db.add(db_sow)
    db.commit()
    db.refresh(db_sow)

    return db_sow
    
def parse_sow(sow_id: int, db: Session):
    """Run the parsing + classification pipeline on an uploaded SOW."""

    db_sow = db.query(Sow).filter(Sow.id == sow_id).first()
    if not db_sow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SOW not found",
        )

    if db_sow.status not in (SOWStatus.UPLOADED, SOWStatus.FAILED,SOWStatus.PARSED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SOW is already in '{db_sow.status}' state. "
                   f"Can only parse when status is 'uploaded' or 'failed'.",
        )

    # mark as parsing
    db_sow.status = SOWStatus.PARSING
    db.commit()

    try:
        parsed: ParsedSOW = _parser.parse(db_sow.path_or_url)

        # update the sow record
        db_sow.raw_text = parsed.raw_text
        db_sow.markdown_text = parsed.markdown
        db_sow.metadata_json = parsed.metadata
        db_sow.status = SOWStatus.PARSED

        # delete old sections/tables if re-parsing
        db.query(SOWSection).filter(SOWSection.sow_id == sow_id).delete()
        db.query(SOWTable).filter(SOWTable.sow_id == sow_id).delete()

        # insert sections
        for idx, section in enumerate(parsed.sections):
            db.add(SOWSection(
                sow_id=sow_id,
                title=section.title,
                content=section.content,
                level=section.level,
                section_order=idx,
                section_type=section.section_type,
                confidence=section.confidence,
                page_number=section.page_number,
            ))

        # insert tables
        for idx, table in enumerate(parsed.tables):
            db.add(SOWTable(
                sow_id=sow_id,
                headers=table.headers,
                rows=table.rows,
                num_rows=table.num_rows,
                parent_section=table.parent_section,
                table_order=idx,
            ))

        db.commit()
        db.refresh(db_sow)

        logger.info(
            f"Parsed SOW {sow_id}: {len(parsed.sections)} sections, "
            f"{len(parsed.tables)} tables"
        )
        return db_sow

    except Exception as e:
        db_sow.status = SOWStatus.FAILED
        db.commit()
        logger.exception(f"Parsing failed for SOW {sow_id}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Parsing failed: {str(e)}",
        )

def get_project_latest_sow(project_id: int, db: Session):
    """Get the most recently uploaded SOW for a project, or None."""
    return (
        db.query(Sow)
        .filter(Sow.project_id == project_id)
        .order_by(Sow.created_at.desc())
        .first()
    )

def get_sow(sow_id: int, db: Session):
    """Get a SOW with all its sections and tables."""

    db_sow = db.query(Sow).filter(Sow.id == sow_id).first()
    if not db_sow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SOW not found",
        )
    return db_sow

def get_sow_sections(sow_id: int, db: Session, section_type: str | None = None):
    """Get sections, optionally filtered by type."""

    query = (
        db.query(SOWSection)
        .filter(SOWSection.sow_id == sow_id)
    )

    if section_type:
        query = query.filter(SOWSection.section_type == section_type)

    return query.order_by(SOWSection.section_order).all()

def get_sow_tables(sow_id: int, db: Session):
    """Get all tables for a SOW."""

    return (
        db.query(SOWTable)
        .filter(SOWTable.sow_id == sow_id)
        .order_by(SOWTable.table_order)
        .all()
    )