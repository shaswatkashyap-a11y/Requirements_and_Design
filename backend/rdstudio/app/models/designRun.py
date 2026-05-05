from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class DesignRun(Base):
    __tablename__ = "design_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    sow_id = Column(Integer, ForeignKey("sows.id", ondelete="SET NULL"), nullable=True)

    # optional link to requirements generation run for context
    generation_run_id = Column(
        Integer,
        ForeignKey("generation_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    # status tracking
    status = Column(
        String(50),
        default="pending",
        comment="pending → generating → completed → failed",
    )
    progress_message = Column(String(500), nullable=True)
    error_log = Column(Text, nullable=True)

    # timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # relationships
    project = relationship("Project", backref="design_runs")
    artifacts = relationship(
        "DesignArtifact",
        back_populates="design_run",
        cascade="all, delete-orphan",
        order_by="DesignArtifact.sort_order",
    )


class DesignArtifact(Base):
    __tablename__ = "design_artifacts"

    id = Column(Integer, primary_key=True, index=True)
    design_run_id = Column(
        Integer,
        ForeignKey("design_runs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # one of: folder_structure | component_structure | design_patterns | technology | error_handling
    section_type = Column(String(50), nullable=False)
    content_markdown = Column(Text, nullable=False)
    sort_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # relationships
    design_run = relationship("DesignRun", back_populates="artifacts")
    versions    = relationship(
        "DesignArtifactVersion",
        back_populates="artifact",
        cascade="all, delete-orphan",
        order_by="DesignArtifactVersion.saved_at.desc()",
    )


class DesignArtifactVersion(Base):
    __tablename__ = "design_artifact_versions"

    id          = Column(Integer, primary_key=True, index=True)
    artifact_id = Column(Integer, ForeignKey("design_artifacts.id", ondelete="CASCADE"), nullable=False)
    content_markdown = Column(Text, nullable=False)
    version_note     = Column(String(100), nullable=True)  # "regenerated" | "manually edited"
    saved_at         = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    artifact = relationship("DesignArtifact", back_populates="versions")
