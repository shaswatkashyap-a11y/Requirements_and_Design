import logging
import redis
from sqlalchemy.orm import Session
from app.config.settings import REDIS_URL
from app.models.artifact import Artifact
from app.models.module import Module
from app.models.generationRun import GenerationRun
from app.models.artifactVersion import ArtifactVersionSource
from app.services.artifactRepository import ArtifactRepository
from app.services.refinementOrchestrator import RefinementOrchestrator
from app.services.artifactSerializer import parse_single_artifact, render_artifact_markdown
from app.services.artifactSerializer import parse_single_artifact, render_artifact_markdown
from app.models.sow import Sow

logger = logging.getLogger(__name__)

_redis = redis.from_url(REDIS_URL)

_LOCK_TTL_SECONDS = 90

class RefinementService:
    """
    Business logic for artifact refinement and manual editing.
    Coordinates: DB reads → LLM call → DB writes → stale cascade.
    """

    def __init__(self, db: Session, orchestrator: RefinementOrchestrator) -> None:
        self.db          = db
        self.repo        = ArtifactRepository(db)
        self.orchestrator= orchestrator

    async def refine_artifact(
        self,
        artifact_id: int,
        run_id: int,
        feedback: str,
        cascade_stale: bool = True,
    ) -> dict:
        """
        Run a targeted LLM refinement for one artifact.

        Steps:
          1. Acquire Redis lock (prevent duplicate concurrent refinements)
          2. Load artifact + module + run context from DB
          3. Call RefinementOrchestrator (builds prompt, calls LLM, parses)
          4. Write new version to DB
          5. Mark downstream artifacts as stale (if cascade_stale=True)
          6. Release Redis lock
        """
        lock_key = f"refinement_lock:{artifact_id}"
        acquired = _redis.set(lock_key, "1", ex=_LOCK_TTL_SECONDS, nx=True)
        if not acquired:
            # Return a clear error so the router can respond with 409 Conflict
            # and the frontend can show "Already refining, please wait."
            raise ValueError("Refinement already in progress for this artifact")
        
        try:
            # ── Load context from DB ─────────────────────────────────────────
            artifact = self.repo.get_artifact_with_version(artifact_id)
            self._assert_belongs_to_run(artifact, run_id)
            module = self.db.query(Module).get(artifact.module_id)
            run    = self.db.query(GenerationRun).get(run_id)
            sow        = self.db.query(Sow).get(run.sow_id)
            project_id = sow.project_id if sow else None

            # ── Call orchestrator (LLM) ──────────────────────────────────────
            raw_xml, llm_meta = await self.orchestrator.refine_artifact(
                artifact_type      = artifact.artifact_type,
                content_json       = artifact.content_json,
                user_feedback      = feedback,
                module_name        = module.name,
                module_description = module.description or "",
                methodology        = run.methodology,
                service_line_codes = run.service_line_codes or [],
                project_id         = project_id,
            )


            # ── Write result to DB ───────────────────────────────────────────
            parsed_dict = parse_single_artifact(raw_xml)
            if parsed_dict is None:
                # unrecognised root tag — store raw as fallback
                parsed_dict = {"raw_xml": raw_xml}
                md = raw_xml
            else:
                md = render_artifact_markdown(artifact.artifact_type, parsed_dict)

            new_version = self.repo.append_version(
                artifact_id         = artifact_id,
                content_json        = parsed_dict,
                content_markdown    = md,
                source              = ArtifactVersionSource.REFINED,
                refinement_feedback = feedback,
                llm_metadata        = llm_meta,
            )

            # ── Stale cascade ────────────────────────────────────────────────
            if cascade_stale:
                downstream = self.repo.get_downstream_artifacts(artifact)
                if downstream:
                    logger.info(
                        f"Marking {len(downstream)} downstream artifacts as stale "
                        f"after refining artifact {artifact_id}"
                    )
                    self.repo.mark_stale([d.id for d in downstream])

            return new_version
        
        finally:
            # Always release the lock — even if the LLM call raised an exception.
            # Without this, a failed refinement would lock the artifact for 90s.
            _redis.delete(lock_key)

    def save_manual_edit(
        self,
        artifact_id: int,
        run_id: int,
        content_markdown: str,
        content_json: dict,
    ):
        """
        Save a user's direct text edit as a new version.
        No LLM call, no lock, no stale cascade — the user edited consciously.
        """
        artifact = self.repo.get_artifact_with_version(artifact_id)
        self._assert_belongs_to_run(artifact, run_id)

        return self.repo.append_version(
            artifact_id      = artifact_id,
            content_json     = content_json,
            content_markdown = content_markdown,
            source           = ArtifactVersionSource.MANUAL,
            # No feedback or LLM metadata for manual edits
        )

    def _assert_belongs_to_run(self, artifact: Artifact, run_id: int) -> None:
        """
        Security check: ensure the artifact belongs to the generation run
        specified in the URL. Prevents a user from refining artifacts from
        another user's run by guessing artifact IDs.
        """
        module = self.db.query(Module).get(artifact.module_id)
        if module.generation_run_id != run_id:
            raise PermissionError(
                f"Artifact {artifact.id} does not belong to generation run {run_id}"
            )
