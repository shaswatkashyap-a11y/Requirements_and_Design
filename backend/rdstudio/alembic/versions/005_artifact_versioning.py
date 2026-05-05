"""
Add artifact versioning: artifact_versions table + stale_status/current_version_id on artifacts.

This migration does four things:
  1. Creates the artifact_versions table.
  2. Adds stale_status, dependency_hash, current_version_id columns to artifacts.
  3. Backfills artifact_versions with one row per existing artifact (version 1, source=generated)
     so existing data is not orphaned.
  4. Points current_version_id at the backfilled row for each artifact.

MySQL note: the circular FK (artifacts.current_version_id → artifact_versions.id AND
artifact_versions.artifact_id → artifacts.id) requires use_alter=True so Alembic emits
a separate ALTER TABLE after both tables exist.

Revision ID: 005
Down revision: 004
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_artifact_versioning'
down_revision: Union[str, Sequence[str], None] = '21c447f513e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade():
    # ── Step 1: Create artifact_versions ────────────────────────────────────────
    # We create this table FIRST (before adding the FK column to artifacts)
    # because artifact_versions.artifact_id references artifacts, not the other way.
    op.create_table(
        "artifact_versions",
        sa.Column("id",                  sa.Integer(),  primary_key=True),
        sa.Column("artifact_id",         sa.Integer(),
                  sa.ForeignKey("artifacts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number",      sa.Integer(),  nullable=False),
        sa.Column("content_json",        sa.JSON(),     nullable=False),
        sa.Column("content_markdown",    sa.Text(),     nullable=True),
        sa.Column("refinement_feedback", sa.Text(),     nullable=True),
        sa.Column(
            "source",
            sa.Enum("generated", "refined", "manual", name="artifactversionsource"),
            nullable=False,
        ),
        sa.Column("llm_metadata",        sa.JSON(),     nullable=True),
        sa.Column("created_at",          sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_index("ix_av_artifact_id", "artifact_versions", ["artifact_id"])
    op.create_unique_constraint(
        "uq_artifact_version_number",
        "artifact_versions",
        ["artifact_id", "version_number"],
    )

    # ── Step 2: Add new columns to artifacts ────────────────────────────────────
    op.add_column(
        "artifacts",
        sa.Column(
            "stale_status",
            sa.Enum("current", "stale", "stale_acknowledged", name="stalestatus"),
            nullable=False,
            server_default="current",   # all existing artifacts start as current
        ),
    )
    op.add_column(
        "artifacts",
        sa.Column("dependency_hash", sa.String(64), nullable=True),
    )
    # nullable=True at first — we populate it in step 4, then it will always be set
    # for new artifacts by the service layer.
    op.add_column(
        "artifacts",
        sa.Column("current_version_id", sa.Integer(), nullable=True),
    )

    # ── Step 3: Backfill artifact_versions for every existing artifact ──────────
    # Every existing artifact gets a version 1 row so history is complete.
    # We use a raw SQL INSERT ... SELECT because SQLAlchemy ORM models aren't
    # safe to use inside Alembic migrations (models can change after migration runs).
    op.execute("""
        INSERT INTO artifact_versions
            (artifact_id, version_number, content_json, content_markdown, source, created_at)
        SELECT
            id,
            1,
            content_json,
            content_markdown,
            'generated',
            NOW()
        FROM artifacts
    """)

    # ── Step 4: Point current_version_id at the backfilled row ──────────────────
    # MySQL requires JOIN syntax for multi-table UPDATE.
    op.execute("""
        UPDATE artifacts a
        JOIN artifact_versions av
          ON av.artifact_id = a.id AND av.version_number = 1
        SET a.current_version_id = av.id
    """)

    # ── Step 5: Add the circular FK as a separate ALTER ──────────────────────────
    # This must come AFTER the INSERT in step 3 — if we added the FK before
    # populating current_version_id, the NOT NULL constraint would block inserts.
    # use_alter=True makes Alembic emit this as ALTER TABLE ADD CONSTRAINT
    # instead of inline during CREATE TABLE.
    op.create_foreign_key(
        "fk_artifact_current_version",
        "artifacts", "artifact_versions",
        ["current_version_id"], ["id"],
        use_alter=True,
    )

def downgrade():
    op.drop_constraint("fk_artifact_current_version", "artifacts", type_="foreignkey")
    op.drop_column("artifacts", "current_version_id")
    op.drop_column("artifacts", "dependency_hash")
    op.drop_column("artifacts", "stale_status")
    op.drop_table("artifact_versions")