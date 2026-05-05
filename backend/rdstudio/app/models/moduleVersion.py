import enum
from sqlalchemy import Column, Integer, Text, String, ForeignKey, JSON, DateTime, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from app.db.database import Base


class ModuleVersionSource(str, enum.Enum):
    GENERATED = "generated"
    REFINED   = "refined"
    MANUAL    = "manual"


class ModuleVersion(Base):
    __tablename__ = "module_versions"

    id             = Column(Integer, primary_key=True, index=True)
    module_id      = Column(
        Integer,
        ForeignKey("modules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number      = Column(Integer, nullable=False)
    name                = Column(String(255), nullable=False)
    description         = Column(Text, nullable=True)
    refinement_feedback = Column(Text, nullable=True)
    source              = Column(
        SAEnum(ModuleVersionSource, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
    )
    llm_metadata = Column(JSON, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())

    module = relationship(
        "Module",
        foreign_keys=[module_id],
        back_populates="versions",
    )
