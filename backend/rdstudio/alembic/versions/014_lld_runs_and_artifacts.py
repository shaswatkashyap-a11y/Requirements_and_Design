"""014 - LLD runs and artifacts

Creates lld_runs, lld_artifacts, and lld_artifact_versions tables.

Revision ID: 014
Revises: 013
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '014'
down_revision: Union[str, Sequence[str], None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('lld_runs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('project_id', sa.Integer(), nullable=False),
    sa.Column('sow_id', sa.Integer(), nullable=True),
    sa.Column('design_run_id', sa.Integer(), nullable=True),
    sa.Column('generation_run_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.Column('progress_message', sa.String(length=500), nullable=True),
    sa.Column('error_log', sa.Text(), nullable=True),
    sa.Column('started_at', sa.DateTime(), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['design_run_id'],     ['design_runs.id'],     ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['generation_run_id'], ['generation_runs.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['project_id'],        ['projects.id'],        ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sow_id'],            ['sows.id'],            ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lld_runs_id'), 'lld_runs', ['id'], unique=False)
    op.create_table('lld_artifacts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('lld_run_id', sa.Integer(), nullable=False),
    sa.Column('section_type', sa.String(length=50), nullable=False),
    sa.Column('content_markdown', sa.Text(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['lld_run_id'], ['lld_runs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lld_artifacts_id'), 'lld_artifacts', ['id'], unique=False)
    op.create_table('lld_artifact_versions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('artifact_id', sa.Integer(), nullable=False),
    sa.Column('content_markdown', sa.Text(), nullable=False),
    sa.Column('version_note', sa.String(length=100), nullable=True),
    sa.Column('saved_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['artifact_id'], ['lld_artifacts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lld_artifact_versions_id'), 'lld_artifact_versions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_lld_artifact_versions_id'), table_name='lld_artifact_versions')
    op.drop_table('lld_artifact_versions')
    op.drop_index(op.f('ix_lld_artifacts_id'), table_name='lld_artifacts')
    op.drop_table('lld_artifacts')
    op.drop_index(op.f('ix_lld_runs_id'), table_name='lld_runs')
    op.drop_table('lld_runs')
