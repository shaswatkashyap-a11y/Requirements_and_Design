from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, Float
from sqlalchemy.orm import relationship
from app.db.database import Base


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

    # relationships
    module = relationship("Module", back_populates="artifacts")
    children = relationship("Artifact", backref="parent", remote_side=[id])