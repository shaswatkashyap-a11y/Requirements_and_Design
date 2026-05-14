"""013 - design artifact versions

Creates design_artifact_versions table for versioning design artifacts.

Revision ID: 013
Revises: 012
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '013'
down_revision: Union[str, Sequence[str], None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('design_artifact_versions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('artifact_id', sa.Integer(), nullable=False),
    sa.Column('content_markdown', sa.Text(), nullable=False),
    sa.Column('version_note', sa.String(length=100), nullable=True),
    sa.Column('saved_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['artifact_id'], ['design_artifacts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_design_artifact_versions_id'), 'design_artifact_versions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_design_artifact_versions_id'), table_name='design_artifact_versions')
    op.drop_table('design_artifact_versions')
