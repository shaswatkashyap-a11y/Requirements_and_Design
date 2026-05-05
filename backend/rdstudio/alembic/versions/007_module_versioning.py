"""
Add module versioning: module_versions table + current_version_id on modules.

Four steps:
  1. Create module_versions table.
  2. Add current_version_id column to modules.
  3. Backfill module_versions with version 1 (generated) for every existing module.
  4. Point current_version_id at the backfilled row.

Same circular FK pattern as 005_artifact_versioning — use_alter=True emits the
FK as a separate ALTER TABLE after both tables and data exist.

Revision ID: 007_module_versioning
Down revision: 006_prompt_templates
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007_module_versioning'
down_revision: Union[str, None] = '006_prompt_templates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on:    Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Step 1: Create module_versions ──────────────────────────────────────────
    # Created before the FK column is added to modules, same as artifact_versions
    # was created before artifacts.current_version_id was added.
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

    # ── Step 2: Add current_version_id to modules ────────────────────────────────
    op.add_column(
        "modules",
        sa.Column("current_version_id", sa.Integer(), nullable=True),
    )

    # ── Step 3: Backfill module_versions for every existing module ───────────────
    # Raw SQL — safe to use ORM models inside migrations as models can drift.
    op.execute("""
        INSERT INTO module_versions
            (module_id, version_number, name, description, source, created_at)
        SELECT
            id,
            1,
            name,
            description,
            'generated',
            NOW()
        FROM modules
    """)

    # ── Step 4: Point current_version_id at the backfilled row ──────────────────
    op.execute("""
        UPDATE modules m
        JOIN module_versions mv
          ON mv.module_id = m.id AND mv.version_number = 1
        SET m.current_version_id = mv.id
    """)

    # ── Step 5: Add the circular FK as a separate ALTER ─────────────────────────
    # Must come after the backfill — FK references module_versions.id, which
    # didn't exist until step 3 populated it.
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
