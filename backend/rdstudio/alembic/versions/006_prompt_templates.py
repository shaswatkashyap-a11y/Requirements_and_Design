"""
Add prompt_templates table for configurable LLM prompts.

Stores base templates, methodology instructions, service line instructions,
few-shot examples, and refinement prompts as DB rows. Each section of each
prompt file gets its own row, allowing individual sections to be overridden
via the UI without touching files on disk.

Revision ID: 006_prompt_templates
Down revision: 005_artifact_versioning
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_prompt_templates'
down_revision: Union[str, None] = '005_artifact_versioning'
branch_labels: Union[str, Sequence[str], None] = None
depends_on:    Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table(
        'prompt_templates',
        sa.Column('id',           sa.Integer(),    nullable=False),
        sa.Column('prompt_type',  sa.Enum(
            'base', 'methodology', 'service_line', 'example', 'refinement',
            name='prompttype'
        ), nullable=False),
        sa.Column('artifact_type', sa.String(50),  nullable=True),
        sa.Column('scope_key',     sa.String(100), nullable=True),
        sa.Column('section',       sa.String(50),  nullable=False),
        sa.Column('content',       sa.Text(),      nullable=False),
        sa.Column('project_id',    sa.Integer(),   nullable=True),   
        sa.Column('is_active',     sa.Boolean(),   nullable=False, server_default='1'),
        sa.Column('created_at',    sa.DateTime(),  nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at',    sa.DateTime(),  nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),  
    )
    op.create_index('ix_pt_prompt_type',   'prompt_templates', ['prompt_type'])
    op.create_index('ix_pt_artifact_type', 'prompt_templates', ['artifact_type'])
    op.create_index('ix_pt_scope_key',     'prompt_templates', ['scope_key'])
    op.create_index('ix_pt_project_id',    'prompt_templates', ['project_id'])   


def downgrade() -> None:
    op.drop_index('ix_pt_scope_key',     table_name='prompt_templates')
    op.drop_index('ix_pt_artifact_type', table_name='prompt_templates')
    op.drop_index('ix_pt_prompt_type',   table_name='prompt_templates')
    op.drop_table('prompt_templates')
    op.drop_index('ix_pt_project_id', table_name='prompt_templates')
