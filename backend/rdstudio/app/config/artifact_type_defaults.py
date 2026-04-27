"""
Defines which artifact types are generated for each methodology
and which additional types each service line contributes.

Methodology provides the BASE set.
Service lines ADD to it (never remove).
The union is what gets generated.
"""

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

# fallback if methodology not found
DEFAULT_ARTIFACT_TYPES = [
    "functional_req",
    "nonfunctional_req",
    "test_case",
    "risk_entry",
]


def resolve_artifact_types(
    methodology: str,
    service_line_codes: list[str],
) -> list[str]:
    """
    Resolve the full set of artifact types to generate.
    Methodology provides the base, service lines add extras.
    Returns a deduplicated list preserving dependency-friendly order.
    """
    base = METHODOLOGY_ARTIFACT_TYPES.get(methodology, DEFAULT_ARTIFACT_TYPES)

    extras = []
    for code in service_line_codes:
        extras.extend(SERVICE_LINE_EXTRA_TYPES.get(code, []))

    # deduplicate while preserving order
    seen = set()
    result = []
    for t in base + extras:
        if t not in seen:
            seen.add(t)
            result.append(t)

    return result