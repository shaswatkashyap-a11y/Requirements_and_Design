from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base


class   GenerationRun(Base):
    __tablename__ = "generation_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    sow_id = Column(Integer, ForeignKey("sows.id"), nullable=False)

    # config snapshot — captured at generation time so history is accurate
    # even if project config changes later
    methodology = Column(String(50), nullable=False)
    service_line_codes = Column(JSON, nullable=False)       # ["react", "python", "aws"]
    artifact_types_requested = Column(JSON, nullable=False) # ["functional_req", "nonfunctional_req", ...]

    # status tracking
    status = Column(
        String(50), default="pending",
        comment="pending → extracting_modules → generating_artifacts → completed → failed"
    )
    progress_message = Column(String(500), nullable=True)   # "Generating reqs for Module 3/6"
    current_round = Column(Integer, nullable=True)          # which dependency round we're on
    total_rounds = Column(Integer, nullable=True)           # total rounds to complete

    # reproducibility
    config_snapshot = Column(JSON, nullable=True)           # prompt versions, model params, temperature

    # error handling
    error_log = Column(Text, nullable=True)

    # timestamps
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # relationships
    project = relationship("Project", back_populates="generation_runs")
    sow = relationship("Sow", back_populates="generation_runs")
    modules = relationship("Module", back_populates="generation_run", cascade="all, delete-orphan")