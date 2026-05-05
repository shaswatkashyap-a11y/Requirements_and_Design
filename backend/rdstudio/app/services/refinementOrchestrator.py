import logging
from app.services.llmClient import LLMClient, ParseError
from app.services.promptBuilder import PromptBuilder
from app.services.responseParser import ResponseParser
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

REFINEMENT_TEMPERATURE = 0.2
REFINEMENT_MAX_TOKENS  = 2200

ARTIFACT_ROOT_TAG_MAP = {
    "functional_req":      "functional_requirements",
    "nonfunctional_req":   "nonfunctional_requirements",
    "architecture":        "architecture",
    "task":                "tasks",
    "test_case":           "test_cases",
    "risk_entry":          "risks",
    "epic":                "epics",
    "user_story":          "user_stories",
    "component_design":    "component_design",
    "data_model":          "data_model",
    "traceability_matrix": "traceability_matrix",
}

class RefinementOrchestrator:
    """
    Handles the LLM mechanics for a single-artifact refinement call.
    Knows about prompts, tokens, and parsing. Does NOT touch the database.
    """

    def __init__(self, llm: LLMClient, prompt_builder:PromptBuilder) -> None:
        self.llm = llm
        self.pb = prompt_builder

    async def refine_artifact(
        self,
        artifact_type:      str,
        content_json:       dict | None,
        user_feedback:      str,
        module_name:        str,
        module_description: str,
        methodology:        str,
        service_line_codes: list[str],
        project_id:         int | None = None,
    ) -> tuple[str, dict]:
        """
        Run the refinement LLM call with parse-retry loop.

        Returns:
            raw_xml  — the raw XML string returned by the LLM (validated as parseable)
            metadata — dict with temperature and attempt count for storage in llm_metadata
        """
        root_tag = ARTIFACT_ROOT_TAG_MAP.get(
            artifact_type,
            artifact_type,  # fallback: use the type name itself as the root tag
        )

        system_prompt, user_prompt = self.pb.build_refinement_prompt(
            artifact_type     = artifact_type,
            content_json       = content_json,
            user_feedback     = user_feedback,
            module_name       = module_name,
            module_description= module_description,
            methodology       = methodology,
            service_line_codes= service_line_codes,
            project_id         = project_id,
        )

        attempt_count = 0

        def parse_fn(raw: str) -> str:
            """
            Validates that the LLM output contains parseable XML with the expected
            root tag. Returns the raw string if valid — we store the raw XML, not a
            Python object, so the content_markdown column stays human-readable.
            """
            nonlocal attempt_count
            attempt_count += 1
            # ResponseParser.extract_xml raises ParseError if the XML is malformed.
            # The truncation repair and sanitisation logic inside extract_xml runs here.
            element = ResponseParser.extract_xml(raw, root_tag)
            return ET.tostring(element, encoding="unicode")
        
        def correction_fn(user_p: str, raw: str, err: str) -> str:
            """
            Build the correction prompt for a retry.
            Uses the TRIMMED version to avoid blowing the context window.
            The standard build_correction_prompt prepends the full original user_prompt
            which at ~1,650 tokens would push us over budget on retry.
            """
            return ResponseParser.build_correction_prompt_trimmed(
                malformed_output = raw,
                error_msg        = err,
                artifact_type    = root_tag,
            )
        
        raw_xml = await self.llm.generate_with_retry_parse(
            system_prompt       = system_prompt,
            user_prompt         = user_prompt,
            parser_fn           = parse_fn,
            correction_prompt_fn= correction_fn,
            max_parse_retries   = 2,          # fewer than bulk — user is waiting synchronously
            temperature         = REFINEMENT_TEMPERATURE,
            max_tokens          = REFINEMENT_MAX_TOKENS,
        )

        return raw_xml, {
            "temperature": REFINEMENT_TEMPERATURE,
            "attempts":    attempt_count,
        }