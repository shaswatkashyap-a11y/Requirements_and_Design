#ArtifactRepository is the single place where all database operations for the generation pipeline live. The orchestrator never writes a SQL query — it just calls the repository.

import logging
from datetime import datetime,timezone
from sqlalchemy.orm import Session
from app.models.generationRun import GenerationRun
from app.models.module import Module
from app.models.artifact import Artifact

logger = logging.getLogger(__name__)

class ArtifactRepository:
    """All database operations for the generation pipeline.
    The orchestrator calls this — never touches the DB directly."""

    def __init__(self,db:Session) -> None:
        self.db=db

    def get_generation_run(self,run_id:int):
        run=self.db.query(GenerationRun).get(run_id) #not using filter cause .get() first checks cache increase in performance

        if not run:
            raise ValueError(f"GenerationRun {run_id} not found")
        
        return run
    
    def create_generation_run(
            self, project_id:int, sow_id:int,
            methodology:str, service_line_codes:list[str], artifact_types:list[str],
            config_snapshot:dict | None = None):
        
        run = GenerationRun(
            project_id=project_id,
            sow_id=sow_id,
            methodology=methodology,
            service_line_codes=service_line_codes,
            artifact_types_requested=artifact_types,
            config_snapshot=config_snapshot
        )

        self.db.add(run)
        self.db.commit()
        self.db.refresh(run)
        return run
    
    def update_status(
            self,run_id:int,status:str,
            message:str | None =None,
            current_round:int| None =None,
            total_rounds:int | None =None,
            ):
        run = self.get_generation_run(run_id)
        run.status = status  # type: ignore[assignment]

        if message is not None:
            run.progress_message = message  # type: ignore[assignment]
        if current_round is not None:
            run.current_round = current_round  # type: ignore[assignment]
        if total_rounds is not None:
            run.total_rounds = total_rounds  # type: ignore[assignment]
        
        if status in ("extracting_modules") and not run.started_at:
            run.started_at=datetime.now(timezone.utc)
        
        if status == "completed":
            run.completed_at = datetime.now(timezone.utc)
        self.db.commit()

    def set_failed(self, run_id:int, error:str):

        run = self.get_generation_run(run_id)
        run.status="failed"
        run.error_log=error
        run.completed_at=datetime.now(timezone.utc)
        self.db.commit()

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

    def save_artifacts(self,module_id:int, artifacts_data:list[dict]):
        artifacts=[]

        for i, a in enumerate(artifacts_data):
            art = Artifact(
                module_id=module_id,
                artifact_type=a["artifact_type"],
                title=a["title"],
                content_json=a["content_json"],
                content_markdown=a.get("content_markdown"),
                methodology_format=a.get("methodology_format"),
                parent_artifact_id=a.get("parent_artifact_id"),
                sort_order=i,
                confidence=a.get("confidence"),
                source_section_ids=a.get("source_section_ids"),
            )
            self.db.add(art)
            artifacts.append(art)
        self.db.commit()
        for art in artifacts:
            self.db.refresh(art)
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