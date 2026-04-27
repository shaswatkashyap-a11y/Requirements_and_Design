from sqlalchemy import Column,String,Integer,func,Text,DateTime,ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base

class Requirement(Base):
    __tablename__="requirements"
    id=Column(Integer, primary_key=True,index=True)
    project_id=Column(Integer,ForeignKey("projects.id"),nullable=False)
    module_id=Column(Integer,ForeignKey("modules.id"),nullable=False)

    title=Column(String(225), nullable=False)
    description=Column(Text)
    acceptance_criteria=Column(Text)

    type=Column(String(225),nullable=False)
    priority=Column(String(225),default="Low")  

    project=relationship("Project",back_populates="requirements")
    # module=relationship("Module",back_populates="requirements")
    # project=relationship("Project",back_populates="requirements")