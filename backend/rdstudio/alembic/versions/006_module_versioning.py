"""006 - module versioning

Creates module_versions table and adds current_version_id to modules.
Backfills version 1 for all existing modules.

Same circular FK pattern as 004_artifact_versioning — use_alter=True.

Revision ID: 006
Revises: 005
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on:    Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "module_versions",
        sa.Column("id",                  sa.Integer(),   primary_key=True),
        sa.Column("module_id",           sa.Integer(),
                  sa.ForeignKey("modules.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number",      sa.Integer(),   nullable=False),
        sa.Column("name",                sa.String(255), nullable=False),
        sa.Column("description",         sa.Text(),      nullable=True),
        sa.Column("refinement_feedback", sa.Text(),      nullable=True),
        sa.Column(
            "source",
            sa.Enum("generated", "refined", "manual", name="moduleversionsource"),
            nullable=False,
        ),
        sa.Column("llm_metadata",        sa.JSON(),      nullable=True),
        sa.Column("created_at",          sa.DateTime(),  server_default=sa.func.now()),
    )
    op.create_index("ix_mv_module_id", "module_versions", ["module_id"])

    op.add_column("modules", sa.Column("current_version_id", sa.Integer(), nullable=True))

    op.execute("""
        INSERT INTO module_versions
            (module_id, version_number, name, description, source, created_at)
        SELECT id, 1, name, description, 'generated', NOW()
        FROM modules
    """)

    op.execute("""
        UPDATE modules m
        JOIN module_versions mv ON mv.module_id = m.id AND mv.version_number = 1
        SET m.current_version_id = mv.id
    """)

    op.create_foreign_key(
        "fk_module_current_version",
        "modules", "module_versions",
        ["current_version_id"], ["id"],
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_module_current_version", "modules", type_="foreignkey")
    op.drop_column("modules", "current_version_id")
    op.drop_index("ix_mv_module_id", table_name="module_versions")
    op.drop_table("module_versions")
