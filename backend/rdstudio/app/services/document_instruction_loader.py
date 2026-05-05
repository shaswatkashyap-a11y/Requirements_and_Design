import json
import yaml
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

INSTRUCTIONS_DIR = Path(__file__).parent.parent / "prompts" / "document_instructions"

CATEGORY_PRIORITY = {"erp_crm": 0, "custom_dev": 1, "cloud": 2, "ai_intelligence": 3}


def load_instructions(service_line_codes: list[str], db: Optional[Session] = None) -> dict[str, Any]:
    merged: dict[str, Any] = {
        "terminology": {},
        "roles": [],
        "extra_sections": [],
        "compliance_standards": [],
        "content_notes": [],
        "highlight_artifacts": {},
        "display_names": [],
    }

    seen_section_ids: set[str] = set()
    seen_role_names: set[str] = set()
    seen_standards: set[str] = set()

    loaded: list[tuple[int, dict]] = []

    for code in service_line_codes:
        data: dict | None = None

        # Check DB first for user-added service line configs
        if db is not None:
            from app.models.promptTemplate import PromptTemplate, PromptType
            row = (
                db.query(PromptTemplate)
                .filter(
                    PromptTemplate.prompt_type == PromptType.SERVICE_LINE_CONFIG,
                    PromptTemplate.scope_key == code,
                    PromptTemplate.section == "full",
                    PromptTemplate.is_active == True,
                    PromptTemplate.project_id == None,
                )
                .first()
            )
            if row:
                data = json.loads(row.content)

        # Fall back to disk for default service lines
        if data is None:
            path = INSTRUCTIONS_DIR / f"{code}.yaml"
            if not path.exists():
                continue
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

        priority = CATEGORY_PRIORITY.get(data.get("category", "cloud"), 99)
        loaded.append((priority, data))

    # Sort by priority so highest-priority service line terminology wins
    loaded.sort(key=lambda x: x[0])

    for _, data in loaded:
        merged["terminology"].update(data.get("terminology", {}))
        merged["display_names"].append(data.get("display_name", ""))

        for role in data.get("roles", []):
            if role["name"] not in seen_role_names:
                merged["roles"].append(role)
                seen_role_names.add(role["name"])

        for section in data.get("extra_sections", []):
            if section["id"] not in seen_section_ids:
                merged["extra_sections"].append(section)
                seen_section_ids.add(section["id"])

        for std in data.get("compliance_standards", []):
            if std["name"] not in seen_standards:
                merged["compliance_standards"].append(std)
                seen_standards.add(std["name"])

        merged["content_notes"].extend(data.get("content_notes", []))

        for ha in data.get("highlight_artifacts", []):
            merged["highlight_artifacts"][ha["type"]] = ha["emphasis"]

    return merged
