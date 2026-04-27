from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    generation_run_id = Column(Integer, ForeignKey("generation_runs.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_section_ids = Column(JSON, nullable=True)   # [1, 4, 7] — SOWSection IDs for traceability
    module_order = Column(Integer, default=0)

    # relationships
    generation_run = relationship("GenerationRun", back_populates="modules")
    artifacts = relationship("Artifact", back_populates="module", cascade="all, delete-orphan")