"""010 - seed XML prompts

Seeds base, methodology, service_line, and refinement XML prompt files into
prompt_templates so the Prompt Editor UI shows all prompts on a fresh install.
Without this migration the UI is empty but generation still works (falls back to disk).

Revision ID: 010
Revises: 009
"""
from typing import Union
from pathlib import Path
from alembic import op
from sqlalchemy import text

revision: str = '010'
down_revision: Union[str, None] = '009'
branch_labels = None
depends_on = None

PROMPTS_DIR = Path(__file__).resolve().parents[2] / 'app' / 'prompts'


def _seed(bind, prompt_type: str, directory: Path, key_col: str) -> None:
    if not directory.exists():
        return
    for path in sorted(directory.glob('*.xml')):
        scope_key     = path.stem if key_col == 'scope_key'     else None
        artifact_type = path.stem if key_col == 'artifact_type' else None

        existing = bind.execute(text(
            "SELECT id FROM prompt_templates "
            "WHERE prompt_type = :pt AND scope_key <=> :sk AND artifact_type <=> :at "
            "AND project_id IS NULL"
        ), {'pt': prompt_type, 'sk': scope_key, 'at': artifact_type}).fetchone()

        if existing:
            continue

        content = path.read_text(encoding='utf-8')
        bind.execute(text(
            "INSERT INTO prompt_templates "
            "(prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
            "VALUES (:pt, :at, :sk, 'full', :content, NULL, TRUE, NOW(), NOW())"
        ), {'pt': prompt_type, 'at': artifact_type, 'sk': scope_key, 'content': content})


def upgrade() -> None:
    bind = op.get_bind()
    _seed(bind, 'base',         PROMPTS_DIR / 'base',               'artifact_type')
    _seed(bind, 'methodology',  PROMPTS_DIR / 'methodology',        'scope_key')
    _seed(bind, 'service_line', PROMPTS_DIR / 'service_line',       'scope_key')
    _seed(bind, 'refinement',   PROMPTS_DIR / 'refinement_schemas', 'artifact_type')


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text(
        "DELETE FROM prompt_templates "
        "WHERE prompt_type IN ('base', 'methodology', 'service_line', 'refinement') "
        "AND project_id IS NULL AND section = 'full'"
    ))
