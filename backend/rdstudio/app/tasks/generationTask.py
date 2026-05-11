import asyncio
import logging
from app.config.celery_config import celery_app
from app.db.database import SessionLocal
from app.services.artifactRepository import ArtifactRepository
from app.services.generationRepository import GenerationRepository
from app.services.generationOrchestrator import GenerationOrchestrator

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=0,  # no retry — orchestrator handles its own failure state
    soft_time_limit=540,
    time_limit=600,
)
def run_generation_pipeline(self, generation_run_id: int):
    """
    Celery task — thin wrapper.
    Creates DB session, instantiates orchestrator, runs async pipeline.
    The orchestrator marks the run as failed in the DB if anything goes wrong,
    so we don't retry at the Celery level to avoid duplicate data.
    """
    logger.info(f"Starting generation pipeline for run {generation_run_id}")

    db = SessionLocal()
    try:
        repo = ArtifactRepository(db)
        gen_repo = GenerationRepository(db)
        orchestrator = GenerationOrchestrator(repo=repo, gen_repo=gen_repo)
        asyncio.run(orchestrator.run(generation_run_id))
        logger.info(f"Pipeline completed for run {generation_run_id}")

    except Exception as exc:
        logger.exception(f"Pipeline failed for run {generation_run_id}")
        # Don't retry — orchestrator already marked the run as failed in DB.
        # Re-raise so Celery marks the task as FAILURE (visible in monitoring).

    finally:
        db.close()