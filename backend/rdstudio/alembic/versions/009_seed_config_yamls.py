"""009 - seed config YAMLs

Seeds document_instructions and methodology_configs YAML files into
prompt_templates so they appear in the Prompt Editor UI on fresh install.

Revision ID: 009
Revises: 008
"""
from typing import Union
from pathlib import Path
import json
import yaml
from alembic import op
from sqlalchemy import text

revision: str = '009'
down_revision: Union[str, None] = '008'
branch_labels = None
depends_on = None

PROMPTS_DIR = Path(__file__).resolve().parents[2] / 'app' / 'prompts'


def _seed(bind, prompt_type: str, directory: Path) -> None:
    for path in sorted(directory.glob('*.yaml')):
        if path.stem.startswith('_'):
            continue

        existing = bind.execute(text(
            "SELECT id FROM prompt_templates "
            "WHERE prompt_type = :pt AND scope_key = :sk AND project_id IS NULL"
        ), {'pt': prompt_type, 'sk': path.stem}).fetchone()

        if existing:
            continue

        with open(path, encoding='utf-8') as f:
            data = yaml.safe_load(f)

        bind.execute(text(
            "INSERT INTO prompt_templates "
            "(prompt_type, scope_key, artifact_type, section, content, project_id, is_active, created_at, updated_at) "
            "VALUES (:pt, :sk, NULL, 'full', :content, NULL, TRUE, NOW(), NOW())"
        ), {
            'pt':      prompt_type,
            'sk':      path.stem,
            'content': json.dumps(data),
        })


def upgrade() -> None:
    bind = op.get_bind()
    _seed(bind, 'service_line_config', PROMPTS_DIR / 'document_instructions')
    _seed(bind, 'methodology_config',  PROMPTS_DIR / 'methodology_configs')


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(text(
        "DELETE FROM prompt_templates "
        "WHERE prompt_type IN ('service_line_config', 'methodology_config') "
        "AND project_id IS NULL"
    ))
