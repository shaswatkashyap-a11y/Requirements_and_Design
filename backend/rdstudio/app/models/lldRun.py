from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class LLDRun(Base):
    __tablename__ = "lld_runs"

    id         = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    sow_id     = Column(Integer, ForeignKey("sows.id", ondelete="SET NULL"), nullable=True)

    # link to HLD run so LLD can use HLD sections as context
    design_run_id = Column(
        Integer,
        ForeignKey("design_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    # link to requirements run for FR/NFR context
    generation_run_id = Column(
        Integer,
        ForeignKey("generation_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    status           = Column(String(50), default="pending")  # pending → generating → completed → failed
    progress_message = Column(String(500), nullable=True)
    error_log        = Column(Text, nullable=True)

    started_at   = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    project   = relationship("Project", backref="lld_runs")
    artifacts = relationship(
        "LLDArtifact",
        back_populates="lld_run",
        cascade="all, delete-orphan",
        order_by="LLDArtifact.sort_order",
    )


class LLDArtifact(Base):
    __tablename__ = "lld_artifacts"

    id          = Column(Integer, primary_key=True, index=True)
    lld_run_id  = Column(Integer, ForeignKey("lld_runs.id", ondelete="CASCADE"), nullable=False)

    # one of: class_diagram | sequence_diagrams | api_spec | db_schema | integration_mapping | business_logic
    section_type     = Column(String(50), nullable=False)
    content_markdown = Column(Text, nullable=False)
    sort_order       = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    lld_run  = relationship("LLDRun", back_populates="artifacts")
    versions = relationship(
        "LLDArtifactVersion",
        back_populates="artifact",
        cascade="all, delete-orphan",
        order_by="LLDArtifactVersion.saved_at.desc()",
    )


class LLDArtifactVersion(Base):
    __tablename__ = "lld_artifact_versions"

    id               = Column(Integer, primary_key=True, index=True)
    artifact_id      = Column(Integer, ForeignKey("lld_artifacts.id", ondelete="CASCADE"), nullable=False)
    content_markdown = Column(Text, nullable=False)
    version_note     = Column(String(100), nullable=True)
    saved_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    artifact = relationship("LLDArtifact", back_populates="versions")
