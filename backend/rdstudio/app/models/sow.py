from sqlalchemy import Column,DateTime,Integer, String,Text,func,ForeignKey,JSON,Float
from sqlalchemy.orm import relationship
from app.db.database import Base
from enum import Enum

class SOWStatus(str, Enum):
    UPLOADED = "uploaded"
    PARSING = "parsing"
    PARSED = "parsed"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Sow(Base):
    __tablename__="sows"
    id=Column(Integer,primary_key=True,index=True)
    project_id=Column(Integer, ForeignKey("projects.id"), nullable=False)

    filename = Column(String(255), nullable=False)
    path_or_url=Column(String(512),nullable=True)
    status=Column(String(50),default=SOWStatus.UPLOADED)

    #CONTENT LAADLE
    raw_text=Column(Text,nullable=True)
    markdown_text = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    created_at=Column(DateTime, server_default=func.now())
    updated_at=Column(DateTime, server_default=func.now(),onupdate=func.now())

    project=relationship("Project",back_populates="sows")
    sections=relationship("SOWSection",back_populates="sow", cascade="all, delete-orphan")
    tables = relationship("SOWTable", back_populates="sow", cascade="all, delete-orphan")
    generation_runs=relationship("GenerationRun",back_populates="sow")

    
class SOWSection(Base):
    __tablename__="sow_sections"
    id = Column(Integer, primary_key=True, index=True)
    sow_id = Column(Integer, ForeignKey("sows.id"), nullable=False)

    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)
    level = Column(Integer, default=1)
    section_order = Column(Integer, default=0)
    section_type = Column(String(100), default="unknown")
    confidence = Column(Float, default=0.0)
    page_number = Column(Integer, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    sow=relationship("Sow",back_populates="sections")

class SOWTable(Base):
    __tablename__="sow_tables"
    id = Column(Integer, primary_key=True, index=True)
    sow_id = Column(Integer, ForeignKey("sows.id"), nullable=False)

    headers = Column(JSON)
    rows = Column(JSON)
    num_rows = Column(Integer, default=0)
    parent_section = Column(String(500), nullable=True)
    table_order = Column(Integer, default=0)

    created_at = Column(DateTime, server_default=func.now())

    sow = relationship("Sow", back_populates="tables")