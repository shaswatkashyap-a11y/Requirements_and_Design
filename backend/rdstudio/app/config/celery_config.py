from celery import Celery
from app.config.settings import REDIS_URL

celery_app = Celery(
    "rdstudio",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.tasks.generationTask", "app.tasks.validationTask", "app.tasks.hldTask", "app.tasks.lldTask"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    task_track_started=True,
    task_acks_late=False,
    worker_prefetch_multiplier=1,
    task_soft_time_limit=600,
    task_time_limit=660,
)