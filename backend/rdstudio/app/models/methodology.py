from sqlalchemy import Column, Integer, String, JSON
from app.db.database import Base


class Methodology(Base):
    __tablename__ = "methodologies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=True)
    artifact_types = Column(JSON, nullable=True)