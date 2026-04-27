import re
import json
import logging
import xml.etree.ElementTree as ET
from pydantic import ValidationError
from app.services.llmClient import ParseError

logger=logging.getLogger(__name__)

class ResponseParser:
    """Parses structured output (XML or JSON) from raw LLM text.
    Handles common small-model issues: preamble text, markdown fences,
    missing closing tags."""

    @staticmethod
    def extract_xml(raw: str, root_tag: str | list) -> ET.Element:
        cleaned = re.sub(r"```(?:xml)?\s*", "", raw).strip()
        cleaned = re.sub(r"```\s*$", "", cleaned).strip()

        tags = [root_tag] if isinstance(root_tag, str) else root_tag

        for tag in tags:
            start = cleaned.find(f"<{tag}")
            if start == -1:
                continue

            end = cleaned.rfind(f"</{tag}>")

            if end != -1:
                # normal case — complete XML
                xml_str = cleaned[start: end + len(f"</{tag}>")]
            else:
                # truncated output — attempt repair
                logger.warning(f"Closing </{tag}> not found — attempting truncation repair")
                xml_str = cleaned[start:]

                # find the direct child tag name from the first child element
                # e.g. for <functional_requirements>, the child is <requirement>
                child_match = re.search(r"<(\w+)(?:\s|>)", xml_str[xml_str.find(">") + 1:])
                if child_match:
                    child_tag = child_match.group(1)
                    # trim to the last complete child element
                    last_child_close = xml_str.rfind(f"</{child_tag}>")
                    if last_child_close != -1:
                        xml_str = xml_str[:last_child_close + len(f"</{child_tag}>")]
                else:
                    # no child tags found — trim to last complete closing tag
                    last_complete = xml_str.rfind("</")
                    if last_complete != -1:
                        close_bracket = xml_str.find(">", last_complete)
                        if close_bracket != -1:
                            xml_str = xml_str[:close_bracket + 1]

                # close the root tag
                xml_str += f"\n</{tag}>"

            xml_str = ResponseParser._sanitise_xml(xml_str)

            try:
                return ET.fromstring(xml_str)
            except ET.ParseError as e:
                raise ParseError(f"Invalid XML: {e}. Extracted: {xml_str[:300]}")

        raise ParseError(
            f"Could not find any of {tags} in LLM output. "
            f"Raw starts with: {raw[:200]}"
        )
    
    @staticmethod
    def _sanitise_xml(xml_str: str) -> str:
        # remove <br> and <br/> tags — not valid in our XML schema
        xml_str = re.sub(r"<br\s*/?>", " ", xml_str)
        # remove backticks
        xml_str = xml_str.replace("`", "")
        # escape unescaped & 
        xml_str = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;)", "&amp;", xml_str)
        return xml_str
        
    @staticmethod
    def extract_json(raw: str) -> dict:
        """Extract JSON from LLM output."""
        cleaned = re.sub(r"```(?:json)?\s*", "", raw)
        cleaned = re.sub(r"```\s*$", "", cleaned)

        brace_start = cleaned.find("{")
        bracket_start = cleaned.find("[")

        if brace_start == -1 and bracket_start == -1:
            raise ParseError(f"No JSON found in output: {raw[:200]}")

        start = min(
            brace_start if brace_start != -1 else float("inf"),
            bracket_start if bracket_start != -1 else float("inf"),
        )

        try:
            return json.loads(cleaned[int(start):])
        except json.JSONDecodeError as e:
            raise ParseError(f"Invalid JSON: {e}")
        
    @staticmethod
    def validate_with_schema(data: dict, pydantic_model):
        """Validate parsed data against a Pydantic model."""
        try:
            return pydantic_model.model_validate(data)
        except ValidationError as e:
            raise ParseError(f"Schema validation failed: {e}")
        
    @staticmethod
    def build_correction_prompt(
        original_prompt: str, malformed_output: str, error_msg: str
    ) -> str:
        """Build a follow-up prompt asking the LLM to fix its output."""
        return (
            f"{original_prompt}\n\n"
            f"Your previous response had a formatting error:\n"
            f"Error: {error_msg}\n\n"
            f"Your previous (malformed) response was:\n"
            f"{malformed_output[:1000]}\n\n"
            f"Please respond again with ONLY the correctly formatted XML. "
            f"No preamble, no explanation, just the XML."
        )