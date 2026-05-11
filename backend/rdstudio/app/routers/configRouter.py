import json
from typing import Optional
from app.services.configService import (
    derive_code,
    validate_service_line_xml,
    validate_methodology_xml,
    validate_service_line_yaml,
    validate_methodology_yaml,
    count_service_line_usage,
    count_methodology_usage,
)
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.config.artifact_type_defaults import resolve_artifact_types
from app.db.database import get_db
from app.models.generationRun import GenerationRun
from app.models.methodology import Methodology
from app.models.promptTemplate import PromptTemplate, PromptType
from app.models.serviceLine import ServiceLine, ServiceLineCategory
from app.schemas.configSchemas import (
    DeleteResponse,
    MethodologyCreateResponse,
    MethodologyResponse,
    ServiceLineCategoryResponse,
    ServiceLineCreateResponse,
)
from app.services.methodology_config_loader import load_methodology_config

router = APIRouter(prefix="/config", tags=["Config"])

# ─────────────────────────────────────────────────────────────────────────────
# Existing read endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/service-lines", response_model=list[ServiceLineCategoryResponse])
def get_service_lines(db: Session = Depends(get_db)):
    """Categories with nested service lines, for frontend dropdowns."""
    categories = (
        db.query(ServiceLineCategory)
        .options(joinedload(ServiceLineCategory.service_lines))
        .order_by(ServiceLineCategory.sort_order)
        .all()
    )
    return categories


@router.get("/methodologies", response_model=list[MethodologyResponse])
def get_methodologies(db: Session = Depends(get_db)):
    return db.query(Methodology).all()


@router.get("/methodology/{code}")
def get_methodology_config(code: str, db: Session = Depends(get_db)):
    try:
        return load_methodology_config(code, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/artifact-types")
def get_artifact_types(
    methodology: str,
    service_lines: str = "",
    db: Session = Depends(get_db),
):
    """Preview which artifact types will be generated."""
    codes = [c.strip() for c in service_lines.split(",") if c.strip()]
    types = resolve_artifact_types(methodology, codes, db)
    return {
        "methodology": methodology,
        "service_line_codes": codes,
        "artifact_types": types,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Add service line
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/service-lines", response_model=ServiceLineCreateResponse)
async def add_service_line(
    name: str = Form(...),
    category_id: int = Form(...),
    icon: Optional[str] = Form(None),
    xml_file: UploadFile = File(...),
    yaml_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    code = derive_code(name)
    if not code:
        raise HTTPException(status_code=400, detail="Could not derive a valid code from the provided name")

    if db.query(ServiceLine).filter(ServiceLine.code == code).first():
        raise HTTPException(status_code=400, detail=f"Service line with code '{code}' already exists")

    if not db.query(ServiceLineCategory).filter(ServiceLineCategory.id == category_id).first():
        raise HTTPException(status_code=400, detail=f"Category {category_id} not found")

    xml_content = (await xml_file.read()).decode("utf-8")
    yaml_content = (await yaml_file.read()).decode("utf-8")

    xml_root = validate_service_line_xml(xml_content)
    yaml_data = validate_service_line_yaml(yaml_content)

    # Extract extra artifact types from <artifact_overrides> child tags
    overrides_el = xml_root.find("artifact_overrides")
    extra_artifact_types = [child.tag for child in overrides_el] if overrides_el is not None else []

    # Store XML in prompt_templates (section="full" so get_combined() finds it)
    db.add(PromptTemplate(
        prompt_type=PromptType.SERVICE_LINE,
        scope_key=code,
        section="full",
        content=xml_content,
        project_id=None,
        is_active=True,
    ))

    # Store YAML config as JSON in prompt_templates
    db.add(PromptTemplate(
        prompt_type=PromptType.SERVICE_LINE_CONFIG,
        scope_key=code,
        section="full",
        content=json.dumps(yaml_data),
        project_id=None,
        is_active=True,
    ))

    # Create the service line registry row
    service_line = ServiceLine(
        name=name,
        code=code,
        category_id=category_id,
        icon=icon,
        extra_artifact_types=extra_artifact_types,
    )
    db.add(service_line)
    db.commit()
    db.refresh(service_line)
    return service_line


# ─────────────────────────────────────────────────────────────────────────────
# Delete service line
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/service-lines/by-code/{code}", response_model=DeleteResponse)
def delete_service_line_by_code(code: str, db: Session = Depends(get_db)):
    service_line = db.query(ServiceLine).filter(ServiceLine.code == code).first()
    if not service_line:
        raise HTTPException(status_code=404, detail="Service line not found")

    usage = count_service_line_usage(db, service_line.code)
    if usage > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — '{service_line.name}' is used by {usage} active project(s)",
        )

    db.query(PromptTemplate).filter(
        PromptTemplate.scope_key == service_line.code,
        PromptTemplate.prompt_type.in_([PromptType.SERVICE_LINE, PromptType.SERVICE_LINE_CONFIG]),
        PromptTemplate.project_id == None,
    ).delete(synchronize_session=False)

    db.delete(service_line)
    db.commit()
    return {"detail": f"Service line '{service_line.name}' deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Add methodology
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/methodologies", response_model=MethodologyCreateResponse)
async def add_methodology(
    name: str = Form(...),
    description: Optional[str] = Form(None),
    xml_file: UploadFile = File(...),
    yaml_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    code = derive_code(name)
    if not code:
        raise HTTPException(status_code=400, detail="Could not derive a valid code from the provided name")

    if db.query(Methodology).filter(Methodology.code == code).first():
        raise HTTPException(status_code=400, detail=f"Methodology with code '{code}' already exists")

    xml_content = (await xml_file.read()).decode("utf-8")
    yaml_content = (await yaml_file.read()).decode("utf-8")

    validate_methodology_xml(xml_content)
    yaml_data = validate_methodology_yaml(yaml_content)

    artifact_types = yaml_data.get("artifact_order", [])

    # Store XML in prompt_templates
    db.add(PromptTemplate(
        prompt_type=PromptType.METHODOLOGY,
        scope_key=code,
        section="full",
        content=xml_content,
        project_id=None,
        is_active=True,
    ))

    # Store YAML config as JSON in prompt_templates
    db.add(PromptTemplate(
        prompt_type=PromptType.METHODOLOGY_CONFIG,
        scope_key=code,
        section="full",
        content=json.dumps(yaml_data),
        project_id=None,
        is_active=True,
    ))

    # Create the methodology registry row
    methodology = Methodology(
        name=name,
        code=code,
        description=description,
        artifact_types=artifact_types,
    )
    db.add(methodology)
    db.commit()
    db.refresh(methodology)
    return methodology


# ─────────────────────────────────────────────────────────────────────────────
# Delete methodology
# ───────────────────────────────────────────────────────────────────────────── 

@router.delete("/methodologies/by-code/{code}", response_model=DeleteResponse)
def delete_methodology_by_code(code: str, db: Session = Depends(get_db)):
    methodology = db.query(Methodology).filter(Methodology.code == code).first()
    if not methodology:
        raise HTTPException(status_code=404, detail="Methodology not found")

    usage = count_methodology_usage(db, methodology.code)
    if usage > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete — '{methodology.name}' is used by {usage} active project(s)",
        )

    db.query(PromptTemplate).filter(
        PromptTemplate.scope_key == methodology.code,
        PromptTemplate.prompt_type.in_([PromptType.METHODOLOGY, PromptType.METHODOLOGY_CONFIG]),
        PromptTemplate.project_id == None,
    ).delete(synchronize_session=False)

    db.delete(methodology)
    db.commit()
    return {"detail": f"Methodology '{methodology.name}' deleted successfully"}
