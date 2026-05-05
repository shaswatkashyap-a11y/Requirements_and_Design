import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy import Enum as SAEnum
from sqlalchemy.sql import func
from app.db.database import Base


class PromptType(str, enum.Enum):
    BASE                = "base"
    METHODOLOGY         = "methodology"
    SERVICE_LINE        = "service_line"
    EXAMPLE             = "example"
    REFINEMENT          = "refinement"
    METHODOLOGY_CONFIG  = "methodology_config"
    SERVICE_LINE_CONFIG = "service_line_config"


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id = Column(Integer, primary_key=True, index=True)

    # What category of prompt this row stores.
    prompt_type = Column(
        SAEnum(PromptType, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        index=True,
    )

    artifact_type = Column(String(50), nullable=True, index=True)
    scope_key = Column(String(100), nullable=True, index=True)
    section = Column(String(50), nullable=False)
    content  = Column(Text, nullable=False)

    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    is_active  = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )