import re
import xml.etree.ElementTree as ET
import yaml
from sqlalchemy.orm import Session
from app.models.generationRun import GenerationRun

def derive_code(name: str) -> str:
    code = name.lower().strip()
    code = re.sub(r"[^a-z0-9\s]", "", code)
    code = re.sub(r"\s+", "_", code)
    return re.sub(r"_+", "_", code).strip("_")


def validate_service_line_xml(content: str) -> ET.Element:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")
    if root.find("tech_context") is None:
        raise ValueError("XML missing required <tech_context> tag")
    if root.find("artifact_overrides") is None:
        raise ValueError("XML missing required <artifact_overrides> tag")
    return root


def validate_methodology_xml(content: str) -> ET.Element:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        raise ValueError(f"Invalid XML: {e}")
    if root.find("global_instructions") is None:
        raise ValueError("XML missing required <global_instructions> tag")
    return root


def validate_service_line_yaml(content: str) -> dict:
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML: {e}")
    for key in ("terminology", "roles", "extra_sections"):
        if key not in data:
            raise ValueError(f"YAML missing required key: '{key}'")
    return data


def validate_methodology_yaml(content: str) -> dict:
    try:
        data = yaml.safe_load(content)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML: {e}")
    for key in ("document_title", "functional_req_heading", "artifact_order"):
        if key not in data:
            raise ValueError(f"YAML missing required key: '{key}'")
    return data


def count_service_line_usage(db: Session, code: str) -> int:
    runs = db.query(GenerationRun).all()
    return sum(1 for r in runs if code in (r.service_line_codes or []))


def count_methodology_usage(db: Session, code: str) -> int:
    return db.query(GenerationRun).filter(GenerationRun.methodology == code).count()
