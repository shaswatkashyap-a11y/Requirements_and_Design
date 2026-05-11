from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from app.models.generationRun import GenerationRun

STALE_THRESHOLD_HOURS = 2
IN_PROGRESS_STATUSES = {"extracting_modules", "generating_artifacts", "queued", "pending"}

class GenerationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_generation_run(self, run_id: int) -> GenerationRun:
        run = self.db.query(GenerationRun).get(run_id)
        if not run:
            raise ValueError(f"GenerationRun {run_id} not found")
        return run

    def create_generation_run(
        self, project_id: int, sow_id: int,
        methodology: str, service_line_codes: list[str], artifact_types: list[str],
        config_snapshot: dict | None = None,
    ) -> GenerationRun:
        run = GenerationRun(
            project_id=project_id,
            sow_id=sow_id,
            methodology=methodology,
            service_line_codes=service_line_codes,
            artifact_types_requested=artifact_types,
            config_snapshot=config_snapshot,
        )
        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run

    def update_status(
        self, run_id: int, status: str,
        message: str | None = None,
        current_round: int | None = None,
        total_rounds: int | None = None,
    ) -> None:
        run = self.get_generation_run(run_id)
        run.status = status
        if message is not None:
            run.progress_message = message
        if current_round is not None:
            run.current_round = current_round
        if total_rounds is not None:
            run.total_rounds = total_rounds
        if status == "extracting_modules" and not run.started_at:
            run.started_at = datetime.now(timezone.utc)
        if status == "completed":
            run.completed_at = datetime.now(timezone.utc)
        self.db.commit()

    def set_failed(self, run_id: int, error: str) -> None:
        run = self.get_generation_run(run_id)
        run.status = "failed"
        run.error_log = error
        run.completed_at = datetime.now(timezone.utc)
        self.db.commit()

    def mark_stale_if_needed(self, run: GenerationRun) -> None:
        if run.status not in IN_PROGRESS_STATUSES:
            return
        if not run.started_at:
            return
        started = run.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) - started > timedelta(hours=STALE_THRESHOLD_HOURS):
            run.status = "failed"
            run.error_log = "Run timed out — exceeded maximum duration (2 hours)."
            run.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(run)
