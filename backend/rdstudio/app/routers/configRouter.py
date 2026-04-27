from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session,joinedload
from app.db.database import get_db
from app.models.serviceLine import ServiceLineCategory, ServiceLine
from app.models.methodology import Methodology
from app.schemas.configSchemas import (
    ServiceLineCategoryResponse, MethodologyResponse,
)
from app.config.artifact_type_defaults import resolve_artifact_types


router = APIRouter(prefix="/config", tags=["Config"])


@router.get(
    "/service-lines",
    response_model=list[ServiceLineCategoryResponse],
)
def get_service_lines(db: Session = Depends(get_db)):
    """Categories with nested service lines, for frontend dropdowns."""
    categories = (
        db.query(ServiceLineCategory)
        .options(joinedload(ServiceLineCategory.service_lines))
        .order_by(ServiceLineCategory.sort_order)
        .all()
    )
    return categories


@router.get(
    "/methodologies",
    response_model=list[MethodologyResponse],
)
def get_methodologies(db: Session = Depends(get_db)):
    return db.query(Methodology).all()



@router.get("/artifact-types")
def get_artifact_types(
    methodology: str,
    service_lines: str = "",
):
    """Preview which artifact types will be generated.
    service_lines is a comma-separated string, e.g. 'react,aws'."""
    codes = [c.strip() for c in service_lines.split(",") if c.strip()]
    types = resolve_artifact_types(methodology, codes)
    return {
        "methodology": methodology,
        "service_line_codes": codes,
        "artifact_types": types,
    }