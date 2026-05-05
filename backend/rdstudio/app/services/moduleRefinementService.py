import logging
import xml.etree.ElementTree as ET
from app.services.promptBuilder import PromptBuilder
from app.services.llmClient import LLMClient

logger = logging.getLogger(__name__)

_TEMPERATURE = 0.2
_MAX_TOKENS  = 1200


class ModuleRefinementService:
    def __init__(self) -> None:
        self.llm            = LLMClient()
        self.prompt_builder = PromptBuilder()

    async def refine(
        self,
        current_name:        str,
        current_description: str | None,
        sow_sections_text:   str,
        feedback:            str,
        methodology:         str,
        service_line_codes:  list[str],
    ) -> tuple[str, str | None, dict]:
        """
        Ask the LLM to rewrite the module definition based on feedback.
        Returns (new_name, new_description, llm_metadata).
        Keeps original values if the LLM response cannot be parsed.
        """
        system, user = self.prompt_builder.build_module_refinement_prompt(
            current_name        = current_name,
            current_description = current_description or "",
            sow_sections_text   = sow_sections_text,
            feedback            = feedback,
            methodology         = methodology,
            service_line_codes  = service_line_codes,
        )

        raw = await self.llm.generate(
            system,
            user,
            temperature = _TEMPERATURE,
            max_tokens  = _MAX_TOKENS,
        )

        name, description = self._parse(raw, current_name, current_description)
        return name, description, {"temperature": _TEMPERATURE}

    def _parse(
        self,
        raw:                 str,
        fallback_name:       str,
        fallback_description: str | None,
    ) -> tuple[str, str | None]:
        try:
            text = raw.strip()
            if text.startswith("```"):
                lines = text.split("\n")
                text  = "\n".join(lines[1:]).rsplit("```", 1)[0].strip()

            root        = ET.fromstring(text)
            name        = (root.findtext("name")        or "").strip() or fallback_name
            description = (root.findtext("description") or "").strip() or fallback_description
            return name, description
        except ET.ParseError:
            logger.warning("Module refinement XML parse failed — keeping original values")
            return fallback_name, fallback_description
