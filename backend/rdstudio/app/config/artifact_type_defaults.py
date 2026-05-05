"""
Defines which artifact types are generated for each methodology
and which additional types each service line contributes.

Methodology provides the BASE set.
Service lines ADD to it (never remove).
The union is what gets generated.

For default methodologies and service lines, values come from the hardcoded
dicts below. For user-added entries (stored in DB), values come from the
artifact_types / extra_artifact_types columns on the model tables.
"""
from typing import Optional
from sqlalchemy.orm import Session

METHODOLOGY_ARTIFACT_TYPES: dict[str, list[str]] = {
    "scrum": [
        "functional_req",
        "nonfunctional_req",
        "task",
        "test_case",
        "risk_entry",
    ],
    "agile": [
        "functional_req",
        "nonfunctional_req",
        "task",
        "test_case",
        "risk_entry",
    ],
    "waterfall": [
        "functional_req",
        "nonfunctional_req",
        "test_case",
        "risk_entry",
        "traceability_matrix",
    ],
}

SERVICE_LINE_EXTRA_TYPES: dict[str, list[str]] = {
    "react": ["component_design"],
    "angular": ["component_design"],
    "vue": ["component_design"],
    "aws": ["architecture"],
    "azure": ["architecture"],
    "gcp": ["architecture"],
    "salesforce": ["data_model"],
    "python_dev": [],
    "java": [],
    "dotnet": [],
    "nodejs": [],
    "ios": ["component_design"],
    "android": ["component_design"],
    "devops": ["architecture"],
    "qa_automation": ["test_case"],
    "data_engineering": ["data_model", "architecture"],
}

DEFAULT_ARTIFACT_TYPES = [
    "functional_req",
    "nonfunctional_req",
    "test_case",
    "risk_entry",
]


def resolve_artifact_types(
    methodology: str,
    service_line_codes: list[str],
    db: Optional[Session] = None,
) -> list[str]:
    """
    Resolve the full set of artifact types to generate.
    Methodology provides the base, service lines add extras.
    Checks DB columns first for user-added entries, falls back to hardcoded dicts.
    """
    # Resolve methodology base types
    base = _get_methodology_base(methodology, db)

    # Resolve service line extras
    extras: list[str] = []
    for code in service_line_codes:
        extras.extend(_get_service_line_extras(code, db))

    # Deduplicate while preserving order
    seen: set[str] = set()
    result: list[str] = []
    for t in base + extras:
        if t not in seen:
            seen.add(t)
            result.append(t)

    return result


def _get_methodology_base(methodology: str, db: Optional[Session]) -> list[str]:
    if db is not None:
        from app.models.methodology import Methodology
        row = db.query(Methodology).filter(Methodology.code == methodology).first()
        if row and row.artifact_types:
            return row.artifact_types
    return METHODOLOGY_ARTIFACT_TYPES.get(methodology, DEFAULT_ARTIFACT_TYPES)


def _get_service_line_extras(code: str, db: Optional[Session]) -> list[str]:
    if db is not None:
        from app.models.serviceLine import ServiceLine
        row = db.query(ServiceLine).filter(ServiceLine.code == code).first()
        if row and row.extra_artifact_types is not None:
            return row.extra_artifact_types
    return SERVICE_LINE_EXTRA_TYPES.get(code, [])
