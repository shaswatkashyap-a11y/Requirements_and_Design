"""012 - add project type

Adds project_type column to projects table.
Values: ams | custom_dev | implementation | integration | data_analytics

Revision ID: 012
Revises: 011
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '012'
down_revision: Union[str, Sequence[str], None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('projects', sa.Column('project_type', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'project_type')
