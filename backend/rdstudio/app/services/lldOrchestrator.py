import asyncio
import logging
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.lldRun import LLDRun, LLDArtifact, LLDArtifactVersion
from app.models.designRun import DesignRun, DesignArtifact
from app.models.artifact import Artifact
from app.models.module import Module
from app.models.sow import Sow
from app.models.project import Project
from app.models.generationRun import GenerationRun
from app.services.llmClient import LLMClient
from app.config.settings import PROMPTS_DIR
from app.config.service_line_standards import build_standards_context

logger = logging.getLogger(__name__)

LLD_PROMPTS_DIR = os.path.join(PROMPTS_DIR, "lld")

# 6 LLD sections in generation order
LLD_SECTIONS = [
    ("class_diagram",       "Class Diagram"),
    ("sequence_diagrams",   "Sequence Diagrams"),
    ("api_spec",            "API Specification"),
    ("db_schema",           "Database Schema"),
    ("integration_mapping", "Integration Mapping"),
    ("business_logic",      "Business Logic"),
]

# Project type guidance — same logic as HLD but LLD-focused
PROJECT_TYPE_GUIDANCE: dict[str, str] = {
    "ams": (
        "PROJECT TYPE: Managed Services / AMS / RUN Services engagement.\n"
        "CRITICAL RULES:\n"
        "- Class diagrams must model Salesforce Apex classes or ServiceNow Script Includes — not Java/C# POJOs.\n"
        "- Sequence diagrams must show ticket lifecycle flows: Create → Assign → Escalate → Resolve → Close.\n"
        "- API spec must use Salesforce REST API and ServiceNow Table API — not custom REST endpoints.\n"
        "- Database schema refers to Salesforce object relationships (standard + custom fields) or ServiceNow CMDB — not relational DB tables.\n"
        "- Integration mapping must cover bi-directional sync between Salesforce Cases and ServiceNow Incidents.\n"
        "- Business logic must cover SLA calculation, escalation rules, and auto-assignment logic."
    ),
    "custom_dev": (
        "PROJECT TYPE: Custom Software Development.\n"
        "Design full application class hierarchies, detailed REST API contracts (OpenAPI-style), "
        "normalized database schema (ERD with PKs/FKs), and service layer business logic."
    ),
    "implementation": (
        "PROJECT TYPE: Platform Implementation.\n"
        "Class diagrams represent configuration objects and custom classes. "
        "Sequence diagrams cover data migration and go-live flows. "
        "DB schema covers data migration mappings from legacy system."
    ),
    "integration": (
        "PROJECT TYPE: Integration / Middleware project.\n"
        "Focus on canonical data model, field-level mapping tables, "
        "transformation logic, and API contracts between systems."
    ),
    "data_analytics": (
        "PROJECT TYPE: Data & Analytics project.\n"
        "Class diagrams model pipeline DAGs and processor classes. "
        "DB schema covers warehouse tables with star/snowflake schema. "
        "API spec covers data access and query APIs."
    ),
}


def _load_prompt(section_type: str) -> tuple[str, str]:
    path = os.path.join(LLD_PROMPTS_DIR, f"{section_type}.xml")
    tree = ET.parse(path)
    root = tree.getroot()
    return (
        root.findtext("system", default="").strip(),
        root.findtext("user", default="").strip(),
    )


def _build_sow_summary(sow: Sow | None) -> str:
    if not sow:
        return "No SOW document available."
    text = sow.markdown_text or sow.raw_text or ""
    if len(text) > 1500:
        text = text[:1500] + "\n...[truncated]"
    return text.strip() or "SOW content not available."


def _build_requirements_context(db: Session, generation_run_id: int | None) -> str:
    if not generation_run_id:
        return "No requirements generation run linked."

    run = db.query(GenerationRun).get(generation_run_id)
    if not run or run.status != "completed":
        return "Requirements generation run not completed yet."

    modules = (
        db.query(Module)
        .filter(Module.generation_run_id == generation_run_id)
        .order_by(Module.module_order)
        .all()
    )
    if not modules:
        return "No modules found in requirements run."

    lines = []
    for mod in modules:
        lines.append(f"\nModule: {mod.name} — {mod.description or ''}")
        artifacts = (
            db.query(Artifact)
            .filter(
                Artifact.module_id == mod.id,
                Artifact.artifact_type.in_(["functional_req", "nonfunctional_req", "architecture"]),
            )
            .order_by(Artifact.sort_order)
            .limit(15)
            .all()
        )
        for art in artifacts:
            data = art.content_json or {}
            t = art.artifact_type
            if t == "functional_req":
                lines.append(f"  [FR] {data.get('req_id','')}: {data.get('title', art.title)}")
            elif t == "nonfunctional_req":
                lines.append(f"  [NFR] {data.get('req_id','')}: {data.get('title', art.title)}")
            elif t == "architecture":
                lines.append(f"  [ARCH] {data.get('component_name', art.title)}: {data.get('description','')}")

    context = "\n".join(lines)
    if len(context) > 2500:
        context = context[:2500] + "\n...[truncated]"
    return context


def _build_hld_context(db: Session, design_run_id: int | None) -> str:
    """Extract key facts from HLD artifacts to ground LLD generation."""
    if not design_run_id:
        return "No HLD run linked. Generate LLD based on requirements and SOW only."

    run = db.query(DesignRun).get(design_run_id)
    if not run or run.status != "completed":
        return "Linked HLD run is not completed. Proceeding without HLD context."

    artifacts = (
        db.query(DesignArtifact)
        .filter(DesignArtifact.design_run_id == design_run_id)
        .order_by(DesignArtifact.sort_order)
        .all()
    )

    if not artifacts:
        return "HLD has no artifacts yet."

    # Extract only relevant parts per section (not full content — too large for context)
    sections = {a.section_type: a.content_markdown for a in artifacts}
    lines = ["=== HLD Summary (use as grounding context) ==="]

    # Component names from component_structure
    if "component_structure" in sections:
        text = sections["component_structure"]
        # grab first 600 chars — component names and descriptions
        lines.append("\n[Components]\n" + text[:600] + ("..." if len(text) > 600 else ""))

    # Tech stack choices
    if "technology" in sections:
        text = sections["technology"]
        lines.append("\n[Technology Stack]\n" + text[:500] + ("..." if len(text) > 500 else ""))

    # API paths from api_design
    if "api_design" in sections:
        text = sections["api_design"]
        lines.append("\n[API Design]\n" + text[:500] + ("..." if len(text) > 500 else ""))

    # Entity names from database_design
    if "database_design" in sections:
        text = sections["database_design"]
        lines.append("\n[Data Model]\n" + text[:500] + ("..." if len(text) > 500 else ""))

    return "\n".join(lines)


def _get_project_type_guidance(project: Project, requirements_context: str) -> str:
    ptype = getattr(project, "project_type", None)
    if not ptype:
        # simple keyword detection fallback
        text = requirements_context.lower()
        if any(k in text for k in ["support", "sla", "incident", "ticket", "run services"]):
            ptype = "ams"
        elif any(k in text for k in ["integrate", "sync", "middleware"]):
            ptype = "integration"
        elif any(k in text for k in ["pipeline", "analytics", "warehouse"]):
            ptype = "data_analytics"
        elif any(k in text for k in ["implement", "configure", "go-live"]):
            ptype = "implementation"
        else:
            ptype = "custom_dev"
    return PROJECT_TYPE_GUIDANCE.get(ptype, PROJECT_TYPE_GUIDANCE["custom_dev"])


class LLDOrchestrator:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.llm = LLMClient()

    async def run(self, lld_run_id: int) -> None:
        run = self.db.query(LLDRun).get(lld_run_id)
        if not run:
            raise ValueError(f"LLDRun {lld_run_id} not found")

        run.status = "generating"
        run.started_at = datetime.now(timezone.utc)
        self.db.commit()

        try:
            project: Project = self.db.query(Project).get(run.project_id)
            requirements_context = _build_requirements_context(self.db, run.generation_run_id)
            hld_context = _build_hld_context(self.db, run.design_run_id)

            if run.generation_run_id:
                sow_summary = "Requirements run linked above — use as primary input."
            else:
                sow = self.db.query(Sow).get(run.sow_id) if run.sow_id else None
                sow_summary = _build_sow_summary(sow)

            template_vars = {
                "project_name":          project.name,
                "client_name":           project.client_name or "N/A",
                "methodology":           project.methodology or "Agile",
                "service_lines":         project.service_line or "Not specified",
                "sow_summary":           sow_summary,
                "standards_context":     build_standards_context(project.service_line or ""),
                "requirements_context":  requirements_context,
                "hld_context":           hld_context,
                "project_type_guidance": _get_project_type_guidance(project, requirements_context),
            }

            total = len(LLD_SECTIONS)
            for i, (section_type, label) in enumerate(LLD_SECTIONS):
                run.progress_message = f"Generating {label} ({i + 1}/{total})..."
                self.db.commit()
                logger.info(f"[LLD Run {lld_run_id}] Generating {section_type}")

                content = await self._generate_section(section_type, template_vars)

                artifact = LLDArtifact(
                    lld_run_id=lld_run_id,
                    section_type=section_type,
                    content_markdown=content,
                    sort_order=i,
                )
                self.db.add(artifact)
                self.db.commit()

            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.progress_message = f"All {total} LLD sections generated."
            self.db.commit()

        except Exception as exc:
            logger.exception(f"[LLD Run {lld_run_id}] Failed: {exc}")
            run.status = "failed"
            run.error_log = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise

    async def _generate_section(self, section_type: str, vars: dict, instruction: str | None = None) -> str:
        system_prompt, user_template = _load_prompt(section_type)
        user_prompt = user_template
        for key, value in vars.items():
            user_prompt = user_prompt.replace(f"{{{key}}}", str(value))
        if instruction and instruction.strip():
            user_prompt += f"\n\nADDITIONAL INSTRUCTION FROM USER:\n{instruction.strip()}\n"
        return await self.llm.generate(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.1)

    async def regenerate_section(
        self, lld_run_id: int, section_type: str, instruction: str | None = None
    ) -> LLDArtifact:
        run = self.db.query(LLDRun).get(lld_run_id)
        if not run:
            raise ValueError(f"LLDRun {lld_run_id} not found")

        artifact = (
            self.db.query(LLDArtifact)
            .filter(LLDArtifact.lld_run_id == lld_run_id, LLDArtifact.section_type == section_type)
            .first()
        )
        if not artifact:
            raise ValueError(f"Section '{section_type}' not found in LLD run {lld_run_id}")

        project: Project = self.db.query(Project).get(run.project_id)
        requirements_context = _build_requirements_context(self.db, run.generation_run_id)
        hld_context = _build_hld_context(self.db, run.design_run_id)

        if run.generation_run_id:
            sow_summary = "Requirements run linked — use as primary input."
        else:
            sow = self.db.query(Sow).get(run.sow_id) if run.sow_id else None
            sow_summary = _build_sow_summary(sow)

        template_vars = {
            "project_name":          project.name,
            "client_name":           project.client_name or "N/A",
            "methodology":           project.methodology or "Agile",
            "service_lines":         project.service_line or "Not specified",
            "sow_summary":           sow_summary,
            "standards_context":     build_standards_context(project.service_line or ""),
            "requirements_context":  requirements_context,
            "hld_context":           hld_context,
            "project_type_guidance": _get_project_type_guidance(project, requirements_context),
        }

        # save current version before overwriting
        self.db.add(LLDArtifactVersion(
            artifact_id=artifact.id,
            content_markdown=artifact.content_markdown,
            version_note="regenerated",
        ))

        new_content = await self._generate_section(section_type, template_vars, instruction)
        artifact.content_markdown = new_content
        artifact.created_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(artifact)
        return artifact
