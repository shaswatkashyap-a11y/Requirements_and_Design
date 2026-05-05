import asyncio
import logging
from sqlalchemy.orm import Session
from app.models.artifact import Artifact
from app.models.artifactVersion import ArtifactVersion, ArtifactVersionSource
from app.models.generationRun import GenerationRun
from app.services.moduleRepository import ModuleRepository
from app.services.artifactRepository import ArtifactRepository
from app.services.generationOrchestrator import GenerationOrchestrator
from app.config.artifact_dependencies import resolve_generation_order

logger = logging.getLogger(__name__)


def _replace_artifacts_with_history(
    module_id:     int,
    art_type:      str,
    new_data:      list[dict],
    db:            Session,
    artifact_repo: ArtifactRepository,
) -> None:
    """
    Update existing artifacts in place to preserve version history, then
    create new rows for net-new items and delete surplus rows.
    """
    existing = (
        db.query(Artifact)
        .filter(Artifact.module_id == module_id, Artifact.artifact_type == art_type)
        .order_by(Artifact.sort_order)
        .all()
    )

    for i, new_art in enumerate(new_data):
        if i < len(existing):
            art            = existing[i]
            art.title      = new_art["title"]
            art.sort_order = i
            db.flush()
            artifact_repo.append_version(
                artifact_id      = art.id,
                content_json     = new_art["content_json"],
                content_markdown = new_art.get("content_markdown"),
                source           = ArtifactVersionSource.GENERATED,
            )
        else:
            art = Artifact(
                module_id          = module_id,
                artifact_type      = art_type,
                title              = new_art["title"],
                content_json       = new_art["content_json"],
                content_markdown   = new_art.get("content_markdown"),
                methodology_format = new_art.get("methodology_format"),
                sort_order         = i,
            )
            db.add(art)
            db.flush()
            version = ArtifactVersion(
                artifact_id      = art.id,
                version_number   = 1,
                content_json     = new_art["content_json"],
                content_markdown = new_art.get("content_markdown"),
                source           = ArtifactVersionSource.GENERATED,
            )
            db.add(version)
            db.flush()
            art.current_version_id = version.id
            db.commit()

    surplus = existing[len(new_data):]
    for art in surplus:
        art.current_version_id = None
    if surplus:
        db.flush()
    for art in surplus:
        db.delete(art)
    if surplus:
        db.commit()


class ModuleRegenerationService:
    async def regenerate(self, module_id: int, db: Session) -> None:
        module_repo   = ModuleRepository(db)
        artifact_repo = ArtifactRepository(db)

        module = module_repo.get_by_id(module_id)
        if not module:
            raise ValueError(f"Module {module_id} not found")

        run = db.query(GenerationRun).get(module.generation_run_id)
        if not run:
            raise ValueError(f"GenerationRun {module.generation_run_id} not found")

        sections           = artifact_repo.get_sow_sections(run.sow_id)
        methodology        = run.methodology
        service_line_codes = run.service_line_codes or []
        requested_types    = run.artifact_types_requested or []
        rounds             = resolve_generation_order(requested_types)

        module_dict = {
            "name":               module.name,
            "description":        module.description or "",
            "source_section_ids": module.source_section_ids or [],
        }

        orchestrator  = GenerationOrchestrator(repo=artifact_repo)
        all_artifacts: dict[str, list[dict]] = {}

        for round_types in rounds:
            relevant_sections = orchestrator._get_relevant_sections(module_dict, sections)

            tasks = [
                orchestrator._generate_single_artifact(
                    artifact_type          = art_type,
                    module                 = module_dict,
                    relevant_sections      = relevant_sections,
                    methodology            = methodology,
                    service_line_codes     = service_line_codes,
                    prerequisite_artifacts = all_artifacts,
                )
                for art_type in round_types
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for art_type, result in zip(round_types, results):
                if isinstance(result, Exception):
                    logger.error(f"Regeneration failed: module={module_id} type={art_type}: {result}")
                    continue

                all_artifacts[art_type] = result
                db_artifacts = orchestrator._convert_to_db_format(result, art_type, methodology)
                _replace_artifacts_with_history(module_id, art_type, db_artifacts, db, artifact_repo)

        logger.info(f"Regeneration complete for module {module_id}")
