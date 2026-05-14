import asyncio
import logging
import os
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.designRun import DesignRun, DesignArtifact, DesignArtifactVersion
from app.models.artifact import Artifact
from app.models.module import Module
from app.models.sow import Sow
from app.models.project import Project
from app.models.generationRun import GenerationRun
from app.services.llmClient import LLMClient
from app.config.settings import PROMPTS_DIR
from app.config.service_line_standards import build_standards_context
from app.config.platform_combinations import build_combinations_context

logger = logging.getLogger(__name__)

DESIGN_PROMPTS_DIR = os.path.join(PROMPTS_DIR, "design")

# ── Project type guidance injected into all HLD prompts ───────────────────────

PROJECT_TYPE_GUIDANCE: dict[str, str] = {
    "ams": (
        "PROJECT TYPE: Managed Services / AMS / RUN Services engagement.\n"
        "CRITICAL RULES — follow strictly:\n"
        "- Do NOT design custom databases (no MongoDB, PostgreSQL, Redis) — data lives in Salesforce and ServiceNow's own managed platforms.\n"
        "- Do NOT design generic application folder structures — use Salesforce org structure (force-app/main/default/) and ServiceNow scoped app structure.\n"
        "- Do NOT apply generic GoF software patterns (Factory, Observer, Command) — apply Salesforce-specific patterns (Trigger Framework, Service Layer, Selector) and ServiceNow patterns (Scoped Application, CMDB-centric, IntegrationHub Spoke).\n"
        "- Do NOT design VPCs or custom infrastructure — Salesforce and ServiceNow are SaaS platforms with vendor-managed infrastructure.\n"
        "- Role names must reflect support team structure (e.g. Support Specialist, L1/L2 Support Agent, Service Delivery Manager).\n"
        "- API design must use Salesforce REST API (Cases, Tasks) and ServiceNow Table API (Incident, Change Request) — not custom endpoints.\n"
        "- ServiceNow REST API base path is /api/now/table/{tableName} (e.g. /api/now/table/incident) — NOT /table/incident.do (that is the UI form URL, not the REST API).\n"
        "- ServiceNow authentication for service-to-service integration must use OAuth 2.0 with Connection & Credential Aliases — NOT session-based authentication.\n"
        "- Error handling must cover SLA breach scenarios, ticket escalation, and integration sync failures.\n"
        "- Secrets must use Salesforce Named Credentials and ServiceNow Connection & Credential Aliases — not Azure Key Vault or AWS Secrets Manager unless these are explicitly in the project context.\n"
        "- Salesforce UI technology must be Lightning Web Components (LWC) — NOT Visualforce, which is legacy and deprecated for new development.\n"
        "- Component Interaction Diagram must be ONE single diagram at the end showing all components — do NOT add a separate diagram after each component.\n"
        "- OWASP mitigations must use Salesforce and ServiceNow native mechanisms: Apex parameterized SOQL (no SOQL injection), Salesforce Shield for encryption, ServiceNow GlideRecord API for safe DB access, Salesforce CSP Trusted Sites for XSS. Do NOT use Pydantic, Jinja2, Helmet.js, or any Python/Node.js framework unless explicitly in the service lines."
    ),
    "custom_dev": (
        "PROJECT TYPE: Custom Software Development.\n"
        "Design the full application stack — custom database schema, application folder structure following service line conventions, "
        "software design patterns (GoF, SOLID, Clean Architecture), custom API endpoints for the business domain, and infrastructure architecture."
    ),
    "implementation": (
        "PROJECT TYPE: Platform Implementation (e.g. Salesforce or ServiceNow implementation).\n"
        "CRITICAL RULES:\n"
        "- Focus on configuration, customization, and data migration — not building new software from scratch.\n"
        "- Design declarative-first solutions (Flows, Process Builder) before code-based ones (Apex, Script Includes).\n"
        "- Include data migration strategy and go-live approach.\n"
        "- Role names reflect implementation team (Solution Architect, Business Analyst, Developer, QA Lead).\n"
        "- Do NOT design custom databases — use the platform's native data model."
    ),
    "integration": (
        "PROJECT TYPE: Integration / Middleware project.\n"
        "CRITICAL RULES:\n"
        "- Focus on API contracts, data mapping, and transformation logic between existing systems.\n"
        "- Design middleware layer (MuleSoft, Azure Integration Services, etc.) as the core architecture.\n"
        "- Include retry policies, dead letter queues, and integration error handling.\n"
        "- Data model should focus on canonical data model and field mappings between systems.\n"
        "- Do NOT design full application UI or business logic layers."
    ),
    "data_analytics": (
        "PROJECT TYPE: Data & Analytics project.\n"
        "CRITICAL RULES:\n"
        "- Focus on data pipeline architecture (ingestion, transformation, serving layers).\n"
        "- Apply Medallion Architecture (Bronze/Silver/Gold) or equivalent.\n"
        "- Include data quality checks, lineage tracking, and freshness SLAs.\n"
        "- Database design should cover data warehouse or lakehouse schema.\n"
        "- API design focuses on data access APIs, not traditional CRUD endpoints."
    ),
}

AMS_KEYWORDS = [
    "support", "sla", "response time", "run services", "maintenance",
    "helpdesk", "ticket", "incident", "enhancement service", "application management",
    "best effort", "covered time", "resource capacity",
]
CUSTOM_DEV_KEYWORDS = [
    "build", "develop", "create new", "architect", "microservice",
    "deploy", "ci/cd", "containerize", "new system", "new application",
]
IMPLEMENTATION_KEYWORDS = [
    "implement", "configure", "migrate data", "go-live", "cutover",
    "setup", "rollout", "onboard", "phase 1", "phase 2", "go live",
]
INTEGRATION_KEYWORDS = [
    "integrate", "sync", "middleware", "connect systems", "api gateway",
    "data sync", "webhook", "message queue", "event-driven", "etl",
]
DATA_ANALYTICS_KEYWORDS = [
    "pipeline", "data warehouse", "analytics", "reporting", "lakehouse",
    "dbt", "spark", "dashboard", "bi ", "business intelligence",
]


def _detect_project_type(requirements_context: str) -> str:
    text = requirements_context.lower()
    scores = {
        "ams":            sum(1 for k in AMS_KEYWORDS if k in text),
        "custom_dev":     sum(1 for k in CUSTOM_DEV_KEYWORDS if k in text),
        "implementation": sum(1 for k in IMPLEMENTATION_KEYWORDS if k in text),
        "integration":    sum(1 for k in INTEGRATION_KEYWORDS if k in text),
        "data_analytics": sum(1 for k in DATA_ANALYTICS_KEYWORDS if k in text),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "custom_dev"


def _build_project_type_guidance(project_type: str | None, requirements_context: str) -> str:
    ptype = project_type or _detect_project_type(requirements_context)
    return PROJECT_TYPE_GUIDANCE.get(ptype, PROJECT_TYPE_GUIDANCE["custom_dev"])

HLD_SECTIONS = [
    ("folder_structure",      "Folder Structure"),
    ("component_structure",   "Component Structure"),
    ("design_patterns",       "Design Patterns"),
    ("technology",            "Technology Stack"),
    ("error_handling",        "Error Handling Strategy"),
    ("api_design",            "API Design"),
    ("database_design",       "Database and Data Model"),
    ("er_diagram",            "ER Diagram"),
    ("security_architecture", "Security Architecture"),
    ("page_flow",             "Page Flow & Integration"),
    ("system_architecture",   "System Architecture Diagram"),
]


def _load_prompt(section_type: str) -> tuple[str, str]:
    path = os.path.join(DESIGN_PROMPTS_DIR, f"{section_type}.xml")
    tree = ET.parse(path)
    root = tree.getroot()
    return (
        root.findtext("system", default="").strip(),
        root.findtext("user", default="").strip(),
    )


def _build_sow_summary(sow: Sow | None) -> str:
    """Fallback only — used when no requirements run is linked."""
    if not sow:
        return "No SOW document available."
    text = sow.markdown_text or sow.raw_text or ""
    if len(text) > 2000:
        text = text[:2000] + "\n...[truncated]"
    return text.strip() or "SOW content not available."


def _format_artifact(art: Artifact) -> str:
    data = art.content_json or {}
    t = art.artifact_type

    if t == "functional_req":
        req_id = data.get("req_id", "")
        title = data.get("title", art.title)
        desc = data.get("description", "")
        acs = data.get("acceptance_criteria") or []
        priority = data.get("priority", "")
        lines = [f"  [FR] {req_id}: {title} (priority: {priority})"]
        if desc:
            lines.append(f"    Description: {desc}")
        for ac in acs[:3]:
            lines.append(f"    AC: {ac}")
        return "\n".join(lines)

    if t == "nonfunctional_req":
        req_id = data.get("req_id", "")
        title = data.get("title", art.title)
        desc = data.get("description", "")
        measure = data.get("measurable_criteria", "")
        lines = [f"  [NFR] {req_id}: {title}"]
        if desc:
            lines.append(f"    Description: {desc}")
        if measure:
            lines.append(f"    Measurable: {measure}")
        return "\n".join(lines)

    if t == "architecture":
        name = data.get("component_name", art.title)
        desc = data.get("description", "")
        tech = data.get("technology_suggestion", "")
        lines = [f"  [ARCH] {name}"]
        if desc:
            lines.append(f"    {desc}")
        if tech:
            lines.append(f"    Technology: {tech}")
        return "\n".join(lines)

    if t == "risk_entry":
        risk_id = data.get("risk_id", "")
        desc = data.get("description", art.title)
        mitigation = data.get("mitigation", "")
        lines = [f"  [RISK] {risk_id}: {desc}"]
        if mitigation:
            lines.append(f"    Mitigation: {mitigation}")
        return "\n".join(lines)

    return f"  [{t}] {art.title}"


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
                Artifact.artifact_type.in_(["functional_req", "nonfunctional_req", "architecture", "risk_entry"]),
            )
            .order_by(Artifact.sort_order)
            .limit(20)
            .all()
        )
        for art in artifacts:
            lines.append(_format_artifact(art))

    context = "\n".join(lines)
    if len(context) > 3000:
        context = context[:3000] + "\n...[truncated]"
    return context


class HLDOrchestrator:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.llm = LLMClient()

    async def run(self, design_run_id: int) -> None:
        run = self.db.query(DesignRun).get(design_run_id)
        if not run:
            raise ValueError(f"DesignRun {design_run_id} not found")

        run.status = "generating"
        run.started_at = datetime.now(timezone.utc)
        self.db.commit()

        try:
            project: Project = self.db.query(Project).get(run.project_id)
            requirements_context = _build_requirements_context(self.db, run.generation_run_id)

            # Only load SOW when no requirements run is linked — requirements are the distilled SOW
            if run.generation_run_id:
                sow_summary = "Requirements run linked above — use requirements context as primary input."
            else:
                sow: Sow | None = self.db.query(Sow).get(run.sow_id) if run.sow_id else None
                sow_summary = _build_sow_summary(sow)

            standards_context = build_standards_context(project.service_line or "")

            template_vars = {
                "project_name":           project.name,
                "client_name":            project.client_name or "N/A",
                "methodology":            project.methodology or "Agile",
                "service_lines":          project.service_line or "Not specified",
                "sow_summary":            sow_summary,
                "standards_context":      standards_context,
                "combinations_context":   build_combinations_context(project.service_line or ""),
                "requirements_context":   requirements_context,
                "project_type_guidance":  _build_project_type_guidance(
                    getattr(project, "project_type", None), requirements_context
                ),
            }

            total = len(HLD_SECTIONS)
            for i, (section_type, label) in enumerate(HLD_SECTIONS):
                run.progress_message = f"Generating {label} ({i + 1}/{total})..."
                self.db.commit()
                logger.info(f"[Design Run {design_run_id}] Generating {section_type}")

                content = await self._generate_section(section_type, template_vars)

                artifact = DesignArtifact(
                    design_run_id=design_run_id,
                    section_type=section_type,
                    content_markdown=content,
                    sort_order=i,
                )
                self.db.add(artifact)
                self.db.commit()

            run.status = "completed"
            run.completed_at = datetime.now(timezone.utc)
            run.progress_message = f"HLD generation complete — all {len(HLD_SECTIONS)} sections ready."
            self.db.commit()
            logger.info(f"[Design Run {design_run_id}] Completed successfully")

        except Exception as exc:
            logger.exception(f"[Design Run {design_run_id}] Failed: {exc}")
            run.status = "failed"
            run.error_log = str(exc)
            run.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise

    async def _generate_section(
        self, section_type: str, template_vars: dict, instruction: str | None = None
    ) -> str:
        system_prompt, user_template = _load_prompt(section_type)

        user_prompt = user_template
        for key, value in template_vars.items():
            user_prompt = user_prompt.replace(f"{{{key}}}", str(value))

        if instruction and instruction.strip():
            user_prompt += (
                f"\n\nADDITIONAL INSTRUCTION FROM USER:\n{instruction.strip()}\n"
                "Apply this instruction when generating the section above."
            )

        return await self.llm.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.1,
        )

    def _build_template_vars(self, run: DesignRun) -> dict:
        project: Project = self.db.query(Project).get(run.project_id)
        requirements_context = _build_requirements_context(self.db, run.generation_run_id)

        if run.generation_run_id:
            sow_summary = "Requirements run linked above — use requirements context as primary input."
        else:
            sow: Sow | None = self.db.query(Sow).get(run.sow_id) if run.sow_id else None
            sow_summary = _build_sow_summary(sow)

        return {
            "project_name":          project.name,
            "client_name":           project.client_name or "N/A",
            "methodology":           project.methodology or "Agile",
            "service_lines":         project.service_line or "Not specified",
            "sow_summary":           sow_summary,
            "standards_context":     build_standards_context(project.service_line or ""),
            "combinations_context":  build_combinations_context(project.service_line or ""),
            "requirements_context":  requirements_context,
            "project_type_guidance": _build_project_type_guidance(
                getattr(project, "project_type", None), requirements_context
            ),
        }

    async def regenerate_section(
        self, design_run_id: int, section_type: str, instruction: str | None = None
    ) -> DesignArtifact:
        valid_types = {s[0] for s in HLD_SECTIONS}
        if section_type not in valid_types:
            raise ValueError(f"Unknown section type: {section_type}")

        run = self.db.query(DesignRun).get(design_run_id)
        if not run:
            raise ValueError(f"DesignRun {design_run_id} not found")

        template_vars = self._build_template_vars(run)
        content = await self._generate_section(section_type, template_vars, instruction)

        artifact = (
            self.db.query(DesignArtifact)
            .filter(
                DesignArtifact.design_run_id == design_run_id,
                DesignArtifact.section_type == section_type,
            )
            .first()
        )
        if artifact:
            # save previous version before overwriting
            self.db.add(DesignArtifactVersion(
                artifact_id=artifact.id,
                content_markdown=artifact.content_markdown,
                version_note="regenerated",
            ))
            artifact.content_markdown = content
            artifact.created_at = datetime.now(timezone.utc)
        else:
            sort_order = next((i for i, (s, _) in enumerate(HLD_SECTIONS) if s == section_type), 99)
            artifact = DesignArtifact(
                design_run_id=design_run_id,
                section_type=section_type,
                content_markdown=content,
                sort_order=sort_order,
            )
            self.db.add(artifact)

        self.db.commit()
        self.db.refresh(artifact)
        logger.info(f"[Design Run {design_run_id}] Section '{section_type}' regenerated")
        return artifact
