import logging
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.module import Module
from app.models.moduleVersion import ModuleVersion, ModuleVersionSource
from app.models.artifact import Artifact, StaleStatus

logger = logging.getLogger(__name__)


class ModuleRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, module_id: int) -> Module | None:
        return self.db.query(Module).get(module_id)

    def update(self, module_id: int, name: str, description: str | None) -> Module | None:
        module = self.get_by_id(module_id)
        if not module:
            return None
        module.name        = name
        module.description = description
        self.db.commit()
        self.db.refresh(module)
        return module

    def append_version(
        self,
        module_id:          int,
        name:               str,
        description:        str | None,
        source:             ModuleVersionSource,
        refinement_feedback: str | None = None,
        llm_metadata:       dict | None = None,
    ) -> ModuleVersion:
        """
        Write a new version row and advance current_version_id.
        Mirrors the same pattern as ArtifactRepository.append_version().
        """
        last_num = (
            self.db.query(func.max(ModuleVersion.version_number))
            .filter(ModuleVersion.module_id == module_id)
            .scalar()
        ) or 0

        version = ModuleVersion(
            module_id           = module_id,
            version_number      = last_num + 1,
            name                = name,
            description         = description,
            source              = source,
            refinement_feedback = refinement_feedback,
            llm_metadata        = llm_metadata,
        )
        self.db.add(version)
        self.db.flush()  # get version.id before the UPDATE

        self.db.query(Module).filter(Module.id == module_id).update(
            {"current_version_id": version.id}
        )
        self.db.commit()
        self.db.refresh(version)
        return version

    def get_versions(self, module_id: int) -> list[ModuleVersion]:
        return (
            self.db.query(ModuleVersion)
            .filter(ModuleVersion.module_id == module_id)
            .order_by(ModuleVersion.version_number.desc())
            .all()
        )

    def mark_all_artifacts_stale(self, module_id: int) -> None:
        self.db.query(Artifact).filter(Artifact.module_id == module_id).update(
            {"stale_status": StaleStatus.STALE},
            synchronize_session=False,
        )
        self.db.commit()

    def delete_all_artifacts(self, module_id: int) -> None:
        self.db.query(Artifact).filter(Artifact.module_id == module_id).delete(
            synchronize_session=False,
        )
        self.db.commit()
