import os
import logging
import xml.etree.ElementTree as ET
from app.config.settings import PROMPTS_DIR

logger = logging.getLogger(__name__)


class PromptBuilder:
    """
    Assembles prompts by layering:
      base template + methodology + service lines + few-shot examples

    DB-first, file fallback:
      Checks DB for each prompt section. Falls back to XML file if not found.
      project_id scopes the lookup — project-specific rows take priority over global.

    If no db session is passed (scripts/tests), all methods fall through to files.
    """

    def __init__(self, prompts_dir: str = PROMPTS_DIR, db=None, project_id: int | None = None) -> None:
        self.prompts_dir = prompts_dir
        self.project_id  = project_id
        if db is not None:
            from app.services.promptRepository import PromptRepository
            self.prompt_repo = PromptRepository(db)
        else:
            self.prompt_repo = None

    def build(
        self,
        artifact_type:      str,
        methodology:        str,
        service_line_codes: list[str],
        template_vars:      dict,
    ):
        """Build a complete (system_prompt, user_prompt) pair for generation."""
        base              = self._load_base_template(artifact_type)
        meth_instructions = self._load_methodology_instructions(methodology, artifact_type)
        sl_instructions   = self._merge_service_line_instructions(service_line_codes, artifact_type)
        examples          = self._load_examples(methodology, artifact_type)

        template_vars["methodology_instructions"]  = meth_instructions
        template_vars["service_line_instructions"] = sl_instructions
        template_vars["few_shot_examples"]         = examples

        system_prompt = base["system"]
        user_prompt   = base["user"]

        for key, value in template_vars.items():
            system_prompt = system_prompt.replace(f"{{{key}}}", str(value))
            user_prompt   = user_prompt.replace(f"{{{key}}}", str(value))

        return system_prompt.strip(), user_prompt.strip()

    def _merge_service_line_instructions(self, service_line_codes: list[str], artifact_type: str):
        if not service_line_codes:
            return ""
        parts = []
        for sl_code in service_line_codes:
            instructions = self._load_service_line_instructions(sl_code, artifact_type)
            parts.append(
                f"###{sl_code.replace('_', ' ').upper()} Considerations\n"
                f"{instructions}"
            )
        return "\n\n".join(parts)

    def _load_base_template(self, artifact_type: str) -> dict:
        if self.prompt_repo:
            xml_str = self.prompt_repo.get_combined("base", None, artifact_type, project_id=self.project_id)
            if xml_str:
                try:
                    root = ET.fromstring(xml_str)
                    system = root.findtext("system", default="")
                    user   = root.findtext("user",   default="")
                    if system and user:
                        return {"system": system, "user": user}
                except ET.ParseError:
                    logger.warning(f"Base template DB XML parse failed for {artifact_type}, falling back to file")
        path = os.path.join(self.prompts_dir, "base", f"{artifact_type}.xml")
        tree = ET.parse(path)
        root = tree.getroot()
        return {
            "system": root.findtext("system", default=""),
            "user":   root.findtext("user",   default=""),
        }

    def _load_refinement_schema(self, artifact_type: str) -> str:
        """Load the XML output schema for an artifact type. DB-first, file fallback."""
        if self.prompt_repo:
            content = self.prompt_repo.get_prompt("refinement", artifact_type, None, "schema", project_id=self.project_id)
            if content:
                return content
        path = os.path.join(self.prompts_dir, "refinement_schemas", f"{artifact_type}.xml")
        if not os.path.exists(path):
            logger.warning(f"No refinement schema for: {artifact_type}")
            return ""
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()

    def _load_methodology_instructions(self, methodology: str, artifact_type: str) -> str:
        if self.prompt_repo:
            xml_str = self.prompt_repo.get_combined("methodology", methodology, project_id=self.project_id)
            if xml_str:
                try:
                    root         = ET.fromstring(xml_str)
                    global_inst  = root.findtext("global_instructions", default="") or ""
                    specific     = ""
                    overrides_el = root.find("artifact_overrides")
                    if overrides_el is not None:
                        specific = overrides_el.findtext(artifact_type, default="") or ""
                    if global_inst or specific:
                        return f"{global_inst}\n\n{specific}".strip()
                except ET.ParseError:
                    logger.warning(f"Methodology DB XML parse failed for {methodology}, falling back to file")
        path = os.path.join(self.prompts_dir, "methodology", f"{methodology}.xml")
        if not os.path.exists(path):
            logger.warning(f"No methodology config for: {methodology}")
            return ""
        tree = ET.parse(path)
        root = tree.getroot()
        global_inst  = root.findtext("global_instructions", default="")
        specific     = ""
        overrides_el = root.find("artifact_overrides")
        if overrides_el is not None:
            specific = overrides_el.findtext(artifact_type, default="")
        return f"{global_inst}\n\n{specific}".strip()

    def _load_service_line_instructions(self, service_line_code: str, artifact_type: str) -> str:
        if self.prompt_repo:
            xml_str = self.prompt_repo.get_combined("service_line", service_line_code, project_id=self.project_id)
            if xml_str:
                try:
                    root         = ET.fromstring(xml_str)
                    domain_ctx   = root.findtext("tech_context", default="") or ""
                    specific     = ""
                    overrides_el = root.find("artifact_overrides")
                    if overrides_el is not None:
                        specific = overrides_el.findtext(artifact_type, default="") or ""
                    if domain_ctx or specific:
                        return f"{domain_ctx}\n\n{specific}".strip()
                except ET.ParseError:
                    logger.warning(f"Service line DB XML parse failed for {service_line_code}, falling back to file")
        path = os.path.join(self.prompts_dir, "service_line", f"{service_line_code}.xml")
        if not os.path.exists(path):
            logger.warning(f"No service line config for: {service_line_code}")
            return ""
        tree = ET.parse(path)
        root = tree.getroot()
        domain_ctx   = root.findtext("tech_context", default="")
        specific     = ""
        overrides_el = root.find("artifact_overrides")
        if overrides_el is not None:
            specific = overrides_el.findtext(artifact_type, default="")
        return f"{domain_ctx}\n\n{specific}".strip()

    def _load_examples(self, methodology: str, artifact_type: str) -> str:
        if self.prompt_repo:
            content = self.prompt_repo.get_prompt("example", artifact_type, methodology, "content", project_id=self.project_id)
            if content:
                return f"Here is an example of good output:\n\n{content}"
        path = os.path.join(self.prompts_dir, "examples", methodology, f"{artifact_type}_example.xml")
        if not os.path.exists(path):
            return ""
        with open(path, "r") as f:
            content = f.read()
        return f"Here is an example of good output:\n\n{content}"

    # ── Artifact refinement prompts ────────────────────────────────────────────

    _REFINEMENT_SYSTEM = (
        "You are a requirements engineering assistant. "
        "Refine the artifact based strictly on the user_feedback. "
        "Preserve every field not addressed by the feedback. "
        "Return ONLY the complete refined artifact as valid XML using the EXACT schema "
        "shown in <required_output_format>. "
        "No preamble, no explanation, no markdown fences."
    )

    _REFINEMENT_USER_TEMPLATE = """\
    <refinement_request>
      <context>
        <methodology>{methodology}</methodology>
        <service_lines>{service_lines}</service_lines>
        <module_name>{module_name}</module_name>
        <module_summary>{module_summary}</module_summary>
      </context>
      <existing_artifact type="{artifact_type}">
    {existing_labeled}
      </existing_artifact>
      <required_output_format>
        Return the artifact in EXACTLY this XML structure — same tags, same nesting:
    {output_schema}
        Omit optional leaf elements when they have no value. Preserve unchanged field values.
      </required_output_format>
      <user_feedback>{user_feedback}</user_feedback>
    </refinement_request>"""

    # ── Module refinement prompts ──────────────────────────────────────────────

    _MODULE_REFINEMENT_SYSTEM = (
        "You are a software architect refining functional module definitions for a project. "
        "Update the module's name and/or description based on the user_feedback. "
        "Keep the module focused on a single cohesive area of software functionality. "
        "Return ONLY valid XML in this exact format: "
        "<module><name>updated module name</name><description>updated description</description></module>. "
        "No preamble, no explanation, no markdown fences."
    )

    _MODULE_REFINEMENT_USER_TEMPLATE = """\
    <module_refinement_request>
      <context>
        <methodology>{methodology}</methodology>
        <service_lines>{service_lines}</service_lines>
        <sow_sections>{sow_sections}</sow_sections>
      </context>
      <current_module>
        <name>{current_name}</name>
        <description>{current_description}</description>
      </current_module>
      <required_output_format>
        <module>
          <name>updated module name</name>
          <description>updated description</description>
        </module>
      </required_output_format>
      <user_feedback>{user_feedback}</user_feedback>
    </module_refinement_request>"""

    @staticmethod
    def _label_functional_req(d: dict) -> str:
        lines = [
            f"ID: {d.get('req_id', '')}",
            f"Title: {d.get('title', '')}",
            f"Description: {d.get('description', '')}",
        ]
        if d.get("user_story"):
            lines.append(f"User Story: {d['user_story']}")
        for c in (d.get("acceptance_criteria") or []):
            lines.append(f"Criterion: {c}")
        lines.append(f"Priority: {d.get('priority', 'medium')}")
        if d.get("source_section"):
            lines.append(f"Source Section: {d['source_section']}")
        return "\n".join(lines)

    @staticmethod
    def _label_nfr(d: dict) -> str:
        lines = [
            f"ID: {d.get('req_id', '')}",
            f"Category: {d.get('category', '')}",
            f"Title: {d.get('title', '')}",
            f"Description: {d.get('description', '')}",
        ]
        if d.get("measurable_criteria"):
            lines.append(f"Measurable Criteria: {d['measurable_criteria']}")
        lines.append(f"Priority: {d.get('priority', 'medium')}")
        return "\n".join(lines)

    @staticmethod
    def _label_task(d: dict) -> str:
        lines = [
            f"ID: {d.get('task_id', '')}",
            f"Title: {d.get('title', '')}",
            f"Type: {d.get('task_type', 'task')}",
            f"Description: {d.get('description', '')}",
        ]
        if d.get("parent_task_id"):
            lines.append(f"Parent Task: {d['parent_task_id']}")
        if d.get("estimated_hours"):
            lines.append(f"Estimated Hours: {d['estimated_hours']}")
        for c in (d.get("acceptance_criteria") or []):
            lines.append(f"Criterion: {c}")
        if d.get("linked_requirement_id"):
            lines.append(f"Linked Requirement: {d['linked_requirement_id']}")
        return "\n".join(lines)

    @staticmethod
    def _label_test_case(d: dict) -> str:
        lines = [
            f"ID: {d.get('test_id', '')}",
            f"Title: {d.get('title', '')}",
            f"Linked Requirement: {d.get('linked_requirement_id', '')}",
            f"Test Type: {d.get('test_type', 'functional')}",
        ]
        for p in (d.get("preconditions") or []):
            lines.append(f"Precondition: {p}")
        for s in (d.get("steps") or []):
            lines.append(f"Step: {s}")
        lines.append(f"Expected Result: {d.get('expected_result', '')}")
        return "\n".join(lines)

    @staticmethod
    def _label_architecture(d: dict) -> str:
        lines = [
            f"Component: {d.get('component_name', '')}",
            f"Description: {d.get('description', '')}",
        ]
        if d.get("technology_suggestion"):
            lines.append(f"Technology: {d['technology_suggestion']}")
        for i in (d.get("interfaces") or []):
            lines.append(f"Interface: {i}")
        for e in (d.get("data_entities") or []):
            lines.append(f"Data Entity: {e}")
        return "\n".join(lines)

    @staticmethod
    def _label_risk(d: dict) -> str:
        lines = [
            f"ID: {d.get('risk_id', '')}",
            f"Description: {d.get('description', '')}",
            f"Likelihood: {d.get('likelihood', 'medium')}",
            f"Impact: {d.get('impact', 'medium')}",
            f"Mitigation: {d.get('mitigation', '')}",
        ]
        if d.get("owner"):
            lines.append(f"Owner: {d['owner']}")
        return "\n".join(lines)

    def _format_existing_artifact(self, artifact_type: str, content_json: dict | None) -> str:
        if not content_json:
            return "(no existing content)"
        if set(content_json.keys()) == {"raw_xml"}:
            return content_json["raw_xml"]
        label_fn_map = {
            "functional_req":    self._label_functional_req,
            "nonfunctional_req": self._label_nfr,
            "task":              self._label_task,
            "test_case":         self._label_test_case,
            "architecture":      self._label_architecture,
            "risk_entry":        self._label_risk,
        }
        fn = label_fn_map.get(artifact_type)
        if fn is None:
            import json as _json
            return _json.dumps(content_json, indent=2)
        return fn(content_json)

    def build_refinement_prompt(
        self,
        artifact_type:      str,
        content_json:       dict | None,
        user_feedback:      str,
        module_name:        str,
        module_description: str,
        methodology:        str,
        service_line_codes: list[str],
        project_id:         int | None = None,
    ) -> tuple[str, str]:
        if project_id is not None:
            self.project_id = project_id

        if self.prompt_repo:
            system   = self.prompt_repo.get_prompt("refinement", None, None, "system", project_id=self.project_id) or self._REFINEMENT_SYSTEM
            template = self.prompt_repo.get_prompt("refinement", None, None, "user",   project_id=self.project_id) or self._REFINEMENT_USER_TEMPLATE
        else:
            system   = self._REFINEMENT_SYSTEM
            template = self._REFINEMENT_USER_TEMPLATE

        output_schema    = self._load_refinement_schema(artifact_type)
        module_summary   = self._truncate_to_token_budget(module_description or "", 350)
        existing_labeled = self._format_existing_artifact(artifact_type, content_json)
        existing_trimmed = self._truncate_to_token_budget(existing_labeled, 800)
        feedback_safe    = user_feedback[:400]

        user_prompt = template.format(
            methodology      = methodology,
            service_lines    = ", ".join(service_line_codes),
            module_name      = module_name,
            module_summary   = module_summary,
            artifact_type    = artifact_type,
            existing_labeled = existing_trimmed,
            output_schema    = output_schema,
            user_feedback    = feedback_safe,
        )
        return system, user_prompt.strip()

    def build_module_refinement_prompt(
        self,
        current_name:        str,
        current_description: str,
        sow_sections_text:   str,
        feedback:            str,
        methodology:         str,
        service_line_codes:  list[str],
    ) -> tuple[str, str]:
        sow_trimmed   = self._truncate_to_token_budget(sow_sections_text, 600)
        desc_trimmed  = self._truncate_to_token_budget(current_description, 200)
        feedback_safe = feedback[:400]

        user_prompt = self._MODULE_REFINEMENT_USER_TEMPLATE.format(
            methodology         = methodology,
            service_lines       = ", ".join(service_line_codes),
            sow_sections        = sow_trimmed,
            current_name        = current_name,
            current_description = desc_trimmed,
            user_feedback       = feedback_safe,
        )
        return self._MODULE_REFINEMENT_SYSTEM, user_prompt.strip()

    @staticmethod
    def _truncate_to_token_budget(text: str, token_budget: int) -> str:
        char_limit = token_budget * 4
        if len(text) <= char_limit:
            return text
        return text[:char_limit] + " [truncated for context window]"
