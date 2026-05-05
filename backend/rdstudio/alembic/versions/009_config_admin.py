"""009_config_admin

Adds two new prompt_type enum values (methodology_config, service_line_config)
and new columns on methodologies + service_lines for artifact type resolution.

Revision ID: 009_config_admin
Revises: 008_consolidate_prompts
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = '009_config_admin'
down_revision: Union[str, None] = '008_consolidate_prompts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. Extend prompt_type ENUM with two new values
    bind.execute(text(
        "ALTER TABLE prompt_templates MODIFY COLUMN prompt_type "
        "ENUM('base','methodology','service_line','example','refinement',"
        "'methodology_config','service_line_config') NOT NULL"
    ))

    # 2. Add artifact_types column to methodologies
    op.add_column(
        'methodologies',
        sa.Column('artifact_types', sa.JSON(), nullable=True),
    )

    # 3. Add extra_artifact_types column to service_lines
    op.add_column(
        'service_lines',
        sa.Column('extra_artifact_types', sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('service_lines', 'extra_artifact_types')
    op.drop_column('methodologies', 'artifact_types')

    bind = op.get_bind()
    bind.execute(text(
        "ALTER TABLE prompt_templates MODIFY COLUMN prompt_type "
        "ENUM('base','methodology','service_line','example','refinement') NOT NULL"
    ))
