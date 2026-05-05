from datetime import datetime
from sqlalchemy.orm import Session
from app.models.promptTemplate import PromptTemplate


class PromptRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_combined(
        self,
        prompt_type:   str,
        scope_key:     str | None,
        artifact_type: str | None = None,
        project_id:    int | None = None,
    ) -> str | None:
        """
        Fetch the full combined XML string for a prompt concept.
        Two-step fallback: project-specific active row → global active row → None.
        Used for base, methodology, and service_line types (section='full').
        """
        base_filters = [
            PromptTemplate.prompt_type   == prompt_type,
            PromptTemplate.artifact_type == artifact_type,
            PromptTemplate.scope_key     == scope_key,
            PromptTemplate.section       == "full",
            PromptTemplate.is_active     == True,
        ]

        if project_id is not None:
            row = (
                self.db.query(PromptTemplate)
                .filter(*base_filters, PromptTemplate.project_id == project_id)
                .first()
            )
            if row:
                return row.content

        row = (
            self.db.query(PromptTemplate)
            .filter(*base_filters, PromptTemplate.project_id == None)
            .first()
        )
        return row.content if row else None

    def get_prompt(
        self,
        prompt_type:   str,
        artifact_type: str | None,
        scope_key:     str | None,
        section:       str,
        project_id:    int | None = None,
    ) -> str | None:
        """
        Section-level lookup — kept for refinement type which still uses system/user sections.
        Two-step fallback: project-specific active row → global active row → None.
        """
        base_filters = [
            PromptTemplate.prompt_type   == prompt_type,
            PromptTemplate.artifact_type == artifact_type,
            PromptTemplate.scope_key     == scope_key,
            PromptTemplate.section       == section,
            PromptTemplate.is_active     == True,
        ]

        if project_id is not None:
            row = (
                self.db.query(PromptTemplate)
                .filter(*base_filters, PromptTemplate.project_id == project_id)
                .first()
            )
            if row:
                return row.content

        row = (
            self.db.query(PromptTemplate)
            .filter(*base_filters, PromptTemplate.project_id == None)
            .first()
        )
        return row.content if row else None

    def get_all(self, project_id: int | None = None) -> list[PromptTemplate]:
        if project_id is not None:
            query = self.db.query(PromptTemplate).filter(
                ((PromptTemplate.project_id == None) & (PromptTemplate.is_active == True)) |
                (PromptTemplate.project_id == project_id)
            )
        else:
            query = self.db.query(PromptTemplate).filter(PromptTemplate.is_active == True)

        return query.order_by(
            PromptTemplate.prompt_type,
            PromptTemplate.scope_key,
            PromptTemplate.artifact_type,
        ).all()

    def get_by_id(self, id: int) -> PromptTemplate | None:
        return self.db.query(PromptTemplate).get(id)

    def update_content(self, id: int, content: str) -> PromptTemplate | None:
        row = self.db.query(PromptTemplate).get(id)
        if not row:
            return None
        row.content    = content
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return row

    def deactivate(self, id: int) -> None:
        row = self.db.query(PromptTemplate).get(id)
        if row:
            row.is_active  = False
            row.updated_at = datetime.utcnow()
            self.db.commit()

    def save_project_version(
        self,
        global_prompt_id: int,
        project_id:       int,
        content:          str,
    ) -> PromptTemplate:
        source = self.db.query(PromptTemplate).get(global_prompt_id)
        if not source:
            raise ValueError(f"Prompt {global_prompt_id} not found")

        existing = (
            self.db.query(PromptTemplate)
            .filter(
                PromptTemplate.prompt_type   == source.prompt_type,
                PromptTemplate.artifact_type == source.artifact_type,
                PromptTemplate.scope_key     == source.scope_key,
                PromptTemplate.section       == source.section,
                PromptTemplate.project_id    == project_id,
            )
            .first()
        )

        if existing:
            existing.content    = content
            existing.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing)
            return existing

        row = PromptTemplate(
            prompt_type   = source.prompt_type,
            artifact_type = source.artifact_type,
            scope_key     = source.scope_key,
            section       = source.section,
            project_id    = project_id,
            content       = content,
            is_active     = False,
            created_at    = datetime.utcnow(),
            updated_at    = datetime.utcnow(),
        )
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def activate(self, id: int) -> PromptTemplate | None:
        row = self.db.query(PromptTemplate).get(id)
        if not row:
            return None
        row.is_active  = True
        row.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(row)
        return row

    def deactivate_project_override(
        self,
        global_prompt_id: int,
        project_id:       int,
    ) -> None:
        source = self.db.query(PromptTemplate).get(global_prompt_id)
        if not source:
            return

        existing = (
            self.db.query(PromptTemplate)
            .filter(
                PromptTemplate.prompt_type   == source.prompt_type,
                PromptTemplate.artifact_type == source.artifact_type,
                PromptTemplate.scope_key     == source.scope_key,
                PromptTemplate.section       == source.section,
                PromptTemplate.project_id    == project_id,
            )
            .first()
        )
        if existing:
            existing.is_active  = False
            existing.updated_at = datetime.utcnow()
            self.db.commit()
