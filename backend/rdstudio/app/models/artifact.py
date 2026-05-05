import enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Float
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.database import Base

class StaleStatus(str, enum.Enum):
    """
    Tracks whether an artifact is known to be potentially out-of-date.

    CURRENT            — content reflects the latest state of all dependencies.
    STALE              — an upstream artifact (e.g. functional_req) was refined
                         after this artifact was generated. Content may be wrong.
    STALE_ACKNOWLEDGED — user saw the stale warning and dismissed it. We keep
                         this distinct from CURRENT so we know they made a
                         conscious choice rather than the system resetting silently.
    """
    CURRENT = "current"
    STALE = "stale"
    STALE_ACKNOWLEDGED = "stale_acknowledged"

class Artifact(Base):
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    artifact_type = Column(String(50), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content_json = Column(JSON, nullable=False)             # structured, machine-readable
    content_markdown = Column(Text, nullable=True)          # human-readable rendered version
    methodology_format = Column(String(50), nullable=True)  # scrum / waterfall
    parent_artifact_id = Column(Integer, ForeignKey("artifacts.id"), nullable=True)
    sort_order = Column(Integer, default=0)
    confidence = Column(Float, nullable=True)
    source_section_ids = Column(JSON, nullable=True)        # traceability back to SOW sections
    stale_status = Column(
        SAEnum(StaleStatus, values_callable=lambda obj: [e.value for e in obj]),
        default=StaleStatus.CURRENT,
        nullable=False,
    )
    dependency_hash = Column(String(64), nullable=True)
    current_version_id = Column(
        Integer,
        ForeignKey(
            "artifact_versions.id",
            use_alter=True,
            name="fk_artifact_current_version",
        ),
        nullable=True,
    )

    # relationships
    module = relationship("Module", back_populates="artifacts")
    children = relationship("Artifact", backref="parent", remote_side=[id])
    versions        = relationship(
        "ArtifactVersion",
        foreign_keys="ArtifactVersion.artifact_id",
        back_populates="artifact",
        order_by="ArtifactVersion.version_number",
        passive_deletes=True,
    )
    current_version = relationship(
        "ArtifactVersion",
        foreign_keys=[current_version_id],
    )