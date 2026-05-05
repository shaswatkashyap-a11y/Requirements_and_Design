import json
import yaml
from pathlib import Path
from typing import Any, Optional

from sqlalchemy.orm import Session

METHODOLOGY_CONFIGS_DIR = Path(__file__).parent.parent / "prompts" / "methodology_configs"


def load_methodology_config(methodology: str, db: Optional[Session] = None) -> dict[str, Any]:
    # Check DB first for user-added methodologies
    if db is not None:
        from app.models.promptTemplate import PromptTemplate, PromptType
        row = (
            db.query(PromptTemplate)
            .filter(
                PromptTemplate.prompt_type == PromptType.METHODOLOGY_CONFIG,
                PromptTemplate.scope_key == methodology,
                PromptTemplate.section == "full",
                PromptTemplate.is_active == True,
                PromptTemplate.project_id == None,
            )
            .first()
        )
        if row:
            return json.loads(row.content)

    # Fall back to disk for default methodologies
    path = METHODOLOGY_CONFIGS_DIR / f"{methodology}.yaml"
    if not path.exists():
        available = list_available()
        raise ValueError(
            f"Unsupported methodology '{methodology}'. "
            f"Must be one of: {available}."
        )
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def list_available() -> list[str]:
    return sorted(p.stem for p in METHODOLOGY_CONFIGS_DIR.glob("*.yaml"))
