import asyncio
import logging
from app.config.celery_config import celery_app
from app.db.database import SessionLocal
from app.services.lldOrchestrator import LLDOrchestrator

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=0,
    soft_time_limit=540,
    time_limit=600,
)
def run_lld_pipeline(self, lld_run_id: int):
    logger.info(f"Starting LLD pipeline for run {lld_run_id}")
    db = SessionLocal()
    try:
        orchestrator = LLDOrchestrator(db)
        asyncio.run(orchestrator.run(lld_run_id))
        logger.info(f"LLD pipeline completed for run {lld_run_id}")
    except Exception:
        logger.exception(f"LLD pipeline failed for run {lld_run_id}")
    finally:
        db.close()
