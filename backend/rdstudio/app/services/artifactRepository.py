#ArtifactRepository is the single place where all database operations for the generation pipeline live. The orchestrator never writes a SQL query — it just calls the repository.
from sqlalchemy import func
from app.models.artifactVersion import ArtifactVersion, ArtifactVersionSource
from app.models.artifact import Artifact, StaleStatus
from app.config.artifact_dependencies import ARTIFACT_DEPENDENCIES
import logging
from datetime import datetime,timezone
from sqlalchemy.orm import Session
from app.models.module import Module

logger = logging.getLogger(__name__)

class ArtifactRepository:
    """All database operations for the generation pipeline.
    The orchestrator calls this — never touches the DB directly."""

    def __init__(self,db:Session) -> None:
        self.db=db

    def save_modules(self, run_id:int, modules_data:list[dict]):
        modules=[]
        
        for order,mod in enumerate(modules_data):
            module=Module(
                generation_run_id=run_id,
                name=mod["name"],
                description=mod.get("description",""),
                source_section_ids=mod.get("source_section_ids"),
                module_order=order
            )

            self.db.add(module)
            modules.append(module)
        
        self.db.commit()

        for mod in modules:
            self.db.refresh(mod)
        
        return modules

    def save_artifacts(self, module_id: int, artifacts_data: list[dict]):
        artifacts = []

        for i, a in enumerate(artifacts_data):
            art = Artifact(
                module_id          = module_id,
                artifact_type      = a["artifact_type"],
                title              = a["title"],
                content_json       = a["content_json"],
                content_markdown   = a.get("content_markdown"),
                methodology_format = a.get("methodology_format"),
                parent_artifact_id = a.get("parent_artifact_id"),
                sort_order         = i,
                confidence         = a.get("confidence"),
                source_section_ids = a.get("source_section_ids"),
            )
            self.db.add(art)
            artifacts.append(art)
        self.db.commit()
        for art in artifacts:
            self.db.refresh(art)

        # Create v1 GENERATED version for every artifact so regeneration has
        # a history chain to append to from the very first generation.
        for art in artifacts:
            version = ArtifactVersion(
                artifact_id      = art.id,
                version_number   = 1,
                content_json     = art.content_json,
                content_markdown = art.content_markdown,
                source           = ArtifactVersionSource.GENERATED,
            )
            self.db.add(version)
            self.db.flush()
            art.current_version_id = version.id
        self.db.commit()
        return artifacts

    
    def get_sow_sections(self,sow_id:int):
        """Fetch classified SOW sections for prompt injection."""
        from app.models.sow import SOWSection
        sections = (
            self.db.query(SOWSection).filter(SOWSection.sow_id == sow_id).order_by(SOWSection.section_order).all()
        )

        return [
            {
                "id": s.id,
                "title": s.title,
                "content": s.content,
                "section_type": s.section_type,
                "level": s.level,
                "confidence": s.confidence,
            } for s in sections 
        ]
    
    def get_artifact_with_version(self, artifact_id: int) -> Artifact:
        """
        Fetch an artifact by ID. Raises ValueError if not found so callers
        get a clear error rather than a NoneType AttributeError downstream.
        """
        artifact = self.db.query(Artifact).get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        return artifact
    
    def append_version(
    self,
    artifact_id: int,
    content_json: dict,
    content_markdown: str | None,
    source: ArtifactVersionSource,
    refinement_feedback: str | None = None,
    llm_metadata: dict | None = None,
    ) -> ArtifactVersion:
        """
        Write a new version row and update the artifact's current_version_id pointer.
    
        This is the ONLY method that should write to artifact_versions.
        It keeps three things in sync atomically:
          1. Inserts the new artifact_versions row with version_number = last + 1
          2. Mirrors content to artifacts.content_json / content_markdown (for fast reads)
          3. Updates artifacts.current_version_id to point at the new row
          4. Resets artifacts.stale_status to CURRENT (refinement fixes staleness)
    
        We use flush() before the UPDATE so SQLAlchemy assigns version.id before
        we reference it in the artifacts UPDATE.
        """
        # Get the highest existing version number for this artifact.
        # Returns None if no versions exist yet (shouldn't happen after migration,
        # but defensive coding prevents a crash if it does).
        last_num = (
            self.db.query(func.max(ArtifactVersion.version_number))
            .filter(ArtifactVersion.artifact_id == artifact_id)
            .scalar()
        ) or 0
    
        version = ArtifactVersion(
            artifact_id         = artifact_id,
            version_number      = last_num + 1,
            content_json        = content_json,
            content_markdown    = content_markdown,
            source              = source,
            refinement_feedback = refinement_feedback,
            llm_metadata        = llm_metadata,
        )
        self.db.add(version)
        # flush() writes to DB and assigns version.id without committing the transaction.
        # We need version.id for the UPDATE below. Without flush() it would be None.
        self.db.flush()
    
        # Update the artifact row atomically with the version pointer.
        # We also mirror content here so GET /artifacts reads are O(1) without JOIN.
        self.db.query(Artifact).filter(Artifact.id == artifact_id).update({
            "content_json":        content_json,
            "content_markdown":    content_markdown,
            "current_version_id":  version.id,
            # Refinement or manual edit resolves the artifact's own staleness.
            # Downstream artifacts may still be stale — that's handled separately.
            "stale_status":        StaleStatus.CURRENT,
        })
    
        self.db.commit()
        self.db.refresh(version)
        return version

    def get_version_history(self, artifact_id: int) -> list[ArtifactVersion]:
        """
        Return all versions for an artifact, newest first.
        Used by the version history drawer in the UI.
        """
        return (
            self.db.query(ArtifactVersion)
            .filter(ArtifactVersion.artifact_id == artifact_id)
            .order_by(ArtifactVersion.version_number.desc())
            .all()
        )


    def get_downstream_artifacts(self, artifact: Artifact) -> list[Artifact]:
        """
        Find all artifacts in the same module whose artifact_type lists
        artifact.artifact_type as a dependency.

        Example: if artifact.artifact_type = "functional_req", this returns all
        test_case, task, epic, user_story, architecture artifacts in the same module
        because those types all list "functional_req" in ARTIFACT_DEPENDENCIES.

        We invert the dependency map at runtime rather than storing a separate
        downstream map so there is one source of truth (ARTIFACT_DEPENDENCIES).
        """
        # Invert the map: "which types have artifact.artifact_type in their deps list?"
        downstream_types = [
            art_type
            for art_type, deps in ARTIFACT_DEPENDENCIES.items()
            if artifact.artifact_type in deps
        ]

        # Nothing depends on this artifact type — no cascade needed.
        if not downstream_types:
            return []

        return (
            self.db.query(Artifact)
            .filter(
                Artifact.module_id    == artifact.module_id,
                Artifact.artifact_type.in_(downstream_types),
                # Don't mark the artifact itself as stale
                Artifact.id           != artifact.id,
            )
            .all()
        )


    def mark_stale(self, artifact_ids: list[int]) -> None:
        """
        Bulk-mark a list of artifacts as stale.
        Called after a refinement when cascade_stale=True.

        Uses synchronize_session=False for performance — we're updating many rows
        and don't need SQLAlchemy to track each object individually in the session.
        """
        if not artifact_ids:
            return  # nothing to do — avoids an empty IN () which is invalid SQL

        self.db.query(Artifact).filter(Artifact.id.in_(artifact_ids)).update(
            {"stale_status": StaleStatus.STALE},
            synchronize_session=False,
        )
        self.db.commit()


    def acknowledge_stale(self, artifact_id: int) -> None:
        """
        Mark a stale artifact as acknowledged — the user saw the warning and
        chose not to re-generate. We store STALE_ACKNOWLEDGED rather than resetting
        to CURRENT so we know the user made a deliberate choice vs. the system
        clearing it automatically after a refinement.
        """
        self.db.query(Artifact).filter(Artifact.id == artifact_id).update(
            {"stale_status": StaleStatus.STALE_ACKNOWLEDGED}
        )
        self.db.commit()