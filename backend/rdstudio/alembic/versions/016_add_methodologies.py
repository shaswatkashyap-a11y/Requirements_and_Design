"""add SAFe, Hybrid, Kanban, Lean methodologies

Revision ID: 016_add_methodologies
Revises: 015_add_jira_config
Create Date: 2026-05-11 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '016_add_methodologies'
down_revision: Union[str, Sequence[str], None] = '015_add_jira_config'
branch_labels = None
depends_on = None


def upgrade() -> None:
    methodologies_table = sa.table(
        "methodologies",
        sa.column("id",          sa.Integer),
        sa.column("name",        sa.String),
        sa.column("code",        sa.String),
        sa.column("description", sa.String),
    )
    op.bulk_insert(methodologies_table, [
        {"id": 4, "name": "SAFe",   "code": "safe",   "description": "Scaled Agile Framework — PI planning, ARTs, and program-level features"},
        {"id": 5, "name": "Hybrid", "code": "hybrid", "description": "Formal planning with iterative delivery — combines Waterfall governance and Agile execution"},
        {"id": 6, "name": "Kanban", "code": "kanban", "description": "Continuous flow delivery with WIP limits and pull-based prioritization"},
        {"id": 7, "name": "Lean",   "code": "lean",   "description": "Value-stream focused delivery — eliminate waste, maximize customer value"},
    ])


def downgrade() -> None:
    op.execute("DELETE FROM methodologies WHERE id IN (4, 5, 6, 7)")
