"""add jira config to projects, modules, artifacts

Revision ID: 015_add_jira_config
Revises: 014_add_lld_runs_and_artifacts
Create Date: 2026-05-06 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '015_add_jira_config'
down_revision: Union[str, Sequence[str], None] = '014_add_lld_runs_and_artifacts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Jira credentials stored per-project
    op.add_column('projects', sa.Column('jira_url',         sa.String(255), nullable=True))
    op.add_column('projects', sa.Column('jira_project_key', sa.String(50),  nullable=True))
    op.add_column('projects', sa.Column('jira_user_email',  sa.String(255), nullable=True))
    op.add_column('projects', sa.Column('jira_api_token',   sa.Text(),      nullable=True))

    # Track pushed issues to prevent duplicates and show "View in Jira" links
    op.add_column('modules',   sa.Column('jira_epic_key',  sa.String(50), nullable=True))
    op.add_column('artifacts', sa.Column('jira_issue_key', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('artifacts', 'jira_issue_key')
    op.drop_column('modules',   'jira_epic_key')
    op.drop_column('projects', 'jira_api_token')
    op.drop_column('projects', 'jira_user_email')
    op.drop_column('projects', 'jira_project_key')
    op.drop_column('projects', 'jira_url')
