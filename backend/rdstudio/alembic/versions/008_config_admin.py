"""008 - config admin

Extends prompt_type ENUM with methodology_config and service_line_config.
Adds artifact_types to methodologies and extra_artifact_types to service_lines.

Revision ID: 008
Revises: 007
"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision: str = '008'
down_revision: Union[str, None] = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(text(
        "ALTER TABLE prompt_templates MODIFY COLUMN prompt_type "
        "ENUM('base','methodology','service_line','example','refinement',"
        "'methodology_config','service_line_config') NOT NULL"
    ))

    op.add_column('methodologies',  sa.Column('artifact_types',       sa.JSON(), nullable=True))
    op.add_column('service_lines',  sa.Column('extra_artifact_types', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('service_lines',  'extra_artifact_types')
    op.drop_column('methodologies',  'artifact_types')

    bind = op.get_bind()
    bind.execute(text(
        "ALTER TABLE prompt_templates MODIFY COLUMN prompt_type "
        "ENUM('base','methodology','service_line','example','refinement') NOT NULL"
    ))
