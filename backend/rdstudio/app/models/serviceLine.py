from sqlalchemy.orm import relationship
from sqlalchemy import Column, Integer, ForeignKey, String, Table, JSON
from app.db.database import Base

# junction table: Project ↔ ServiceLine (many-to-many)
project_service_lines = Table(
    "project_service_lines",
    Base.metadata,
    Column("project_id",Integer,ForeignKey("projects.id"),primary_key=True),
    Column("service_line_id",Integer,ForeignKey("service_lines.id"),primary_key=True)
)



class ServiceLineCategory(Base):
    __tablename__="service_line_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)         # "CRM & ERP Platforms"
    code = Column(String(50), unique=True, nullable=False)  # "crm_erp"
    sort_order = Column(Integer, default=0)

    service_lines = relationship("ServiceLine", back_populates="category")

class ServiceLine(Base):
    """  Lightweight — stores only what the UI and validation need.
    All prompt/generation rules live in XML files under prompts/service_line/.
    The 'code' field is the link: code="react" → prompts/service_line/react.xml"""
    __tablename__="service_lines"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("service_line_categories.id"), nullable=False)
    name = Column(String(100), nullable=False)         # "React"
    code = Column(String(50), unique=True, nullable=False)  # "react"
    icon = Column(String(50), nullable=True)
    extra_artifact_types = Column(JSON, nullable=True)

    category = relationship("ServiceLineCategory", back_populates="service_lines")