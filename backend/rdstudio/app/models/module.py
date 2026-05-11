from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.db.database import Base


class Module(Base):
    __tablename__ = "modules"

    id                = Column(Integer, primary_key=True, index=True)
    generation_run_id = Column(Integer, ForeignKey("generation_runs.id"), nullable=False)
    name              = Column(String(255), nullable=False)
    description       = Column(Text, nullable=True)
    source_section_ids = Column(JSON, nullable=True)
    module_order      = Column(Integer, default=0)
    jira_epic_key     = Column(String(50), nullable=True)
    current_version_id = Column(
        Integer,
        ForeignKey(
            "module_versions.id",
            use_alter=True,
            name="fk_module_current_version",
        ),
        nullable=True,
    )

    generation_run = relationship("GenerationRun", back_populates="modules")
    artifacts      = relationship("Artifact", back_populates="module", cascade="all, delete-orphan")
    versions       = relationship(
        "ModuleVersion",
        foreign_keys="ModuleVersion.module_id",
        back_populates="module",
        order_by="ModuleVersion.version_number",
    )
    current_version = relationship(
        "ModuleVersion",
        foreign_keys=[current_version_id],
    )
