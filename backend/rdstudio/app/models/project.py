from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.models.serviceLine import project_service_lines

class Project(Base):
    __tablename__="projects"
    id=Column(Integer, primary_key=True, index=True)

    name=Column(String(225),nullable=False)
    client_name=Column(String(125),nullable=True)
    description=Column(String(500),nullable=True)
    engagement_model=Column(String(50),nullable=True)
    methodology=Column(String(50),nullable=True)
    methodology_code=Column(String(50),nullable=True)
    service_line=Column(String(255),nullable=True)
    project_type=Column(String(50),nullable=True)   # ams | custom_dev | implementation | integration | data_analytics

    created_at=Column(DateTime,server_default=func.now())
    updated_at=Column(DateTime, server_default=func.now(), onupdate=func.now())

    sows=relationship("Sow",back_populates="project",cascade="all, delete-orphan")   
    generation_runs=relationship("GenerationRun",back_populates="project",cascade="all, delete-orphan")

    service_lines=relationship("ServiceLine",secondary=project_service_lines,backref="projects")
    
