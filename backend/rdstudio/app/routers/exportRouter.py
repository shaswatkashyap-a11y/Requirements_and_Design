from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
from app.db.database import get_db
from app.models.generationRun import GenerationRun
from app.services.document_builder import build_document
from app.services.document_instruction_loader import load_instructions

router = APIRouter(prefix="/generation-runs", tags=["Export"])

MIME_TYPES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pdf":  "application/pdf",
}


@router.get("/{run_id}/export-config")
def get_export_config(run_id: int, db: Session = Depends(get_db)):
    run = db.query(GenerationRun).filter(GenerationRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"GenerationRun {run_id} not found")
    instructions = load_instructions(run.service_line_codes or [], db)
    return {
        "terminology":          instructions["terminology"],
        "extra_sections":       instructions["extra_sections"],
        "compliance_standards": instructions["compliance_standards"],
        "roles":                instructions["roles"],
        "display_names":        instructions["display_names"],
    }


@router.get("/{run_id}/export")
def export_requirements_document(
    run_id: int,
    format: str = "docx",
    db: Session = Depends(get_db),
):
    if format not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="format must be 'docx' or 'pdf'")

    if format == "pdf":
        raise HTTPException(
            status_code=501,
            detail="PDF export is not yet available. Please use format=docx.",
        )

    try:
        doc_bytes = build_document(db, run_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    filename = f"requirements_run_{run_id}.{format}"

    return StreamingResponse(
        io.BytesIO(doc_bytes),
        media_type=MIME_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
