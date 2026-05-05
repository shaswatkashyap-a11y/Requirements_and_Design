import asyncio
import logging
from app.config.celery_config import celery_app
from app.db.database import SessionLocal
from app.services.hldOrchestrator import HLDOrchestrator

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=0,
    soft_time_limit=540,
    time_limit=600,
)
def run_hld_pipeline(self, design_run_id: int):
    """
    Celery task — thin wrapper around HLDOrchestrator.
    Orchestrator handles its own failure state in DB, so no retry at Celery level.
    """
    logger.info(f"Starting HLD pipeline for design run {design_run_id}")

    db = SessionLocal()
    try:
        orchestrator = HLDOrchestrator(db)
        asyncio.run(orchestrator.run(design_run_id))
        logger.info(f"HLD pipeline completed for design run {design_run_id}")
    except Exception:
        logger.exception(f"HLD pipeline failed for design run {design_run_id}")
    finally:
        db.close()
