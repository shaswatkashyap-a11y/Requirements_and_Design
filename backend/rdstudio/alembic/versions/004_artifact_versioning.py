"""004 - artifact versioning

Creates artifact_versions table and adds stale_status, dependency_hash,
current_version_id to artifacts. Backfills version 1 for all existing artifacts.

MySQL note: the circular FK (artifacts.current_version_id → artifact_versions.id AND
artifact_versions.artifact_id → artifacts.id) requires use_alter=True.

Revision ID: 004
Revises: 003
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004'
down_revision: Union[str, Sequence[str], None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
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

    op.add_column(
        "artifacts",
        sa.Column(
            "stale_status",
            sa.Enum("current", "stale", "stale_acknowledged", name="stalestatus"),
            nullable=False,
            server_default="current",
        ),
    )
    op.add_column("artifacts", sa.Column("dependency_hash", sa.String(64), nullable=True))
    op.add_column("artifacts", sa.Column("current_version_id", sa.Integer(), nullable=True))

    op.execute("""
        INSERT INTO artifact_versions
            (artifact_id, version_number, content_json, content_markdown, source, created_at)
        SELECT id, 1, content_json, content_markdown, 'generated', NOW()
        FROM artifacts
    """)

    op.execute("""
        UPDATE artifacts a
        JOIN artifact_versions av ON av.artifact_id = a.id AND av.version_number = 1
        SET a.current_version_id = av.id
    """)

    op.create_foreign_key(
        "fk_artifact_current_version",
        "artifacts", "artifact_versions",
        ["current_version_id"], ["id"],
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_artifact_current_version", "artifacts", type_="foreignkey")
    op.drop_column("artifacts", "current_version_id")
    op.drop_column("artifacts", "dependency_hash")
    op.drop_column("artifacts", "stale_status")
    op.drop_table("artifact_versions")
