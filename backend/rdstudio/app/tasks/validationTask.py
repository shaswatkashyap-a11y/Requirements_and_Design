import asyncio
import json
import logging
import re

from app.config.celery_config import celery_app
from app.services.llmClient import LLMClient
from app.config.settings import LLM_BASE_URL

logger = logging.getLogger(__name__)

def safe_parse_llm_json(text: str) -> dict:
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}

def safe_parse_score(val) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0
    
#Celery for valdating modules    
@celery_app.task(bind=True, max_retires=0, time_limit=120)
def validate_module_relevance_task(
    self, module_id: int, module_name: str, module_desc: str, section_texts: list
) -> dict:
    async def _run():
        client = LLMClient(base_url=LLM_BASE_URL)
        sections_combined = "\n\n".join(section_texts) if section_texts else "(no source sections)"

        system_prompt = (
            "You are a software project analyst reviewing a Statement of Work (SOW). "
            "Evaluate whether a software module is relevant to the SOW sections it was derived from. "
            "Respond ONLY with a valid JSON object — no markdown fences, no explanation outside the JSON."
        )
        user_prompt = (
            f"Module Name: {module_name}\n"
            f"Module Description: {module_desc or '(none)'}\n\n"
            f"Source SOW Section Texts:\n{sections_combined[:3000]}\n\n"
            "Rate relevance 1-10. Return ONLY this JSON:\n"
            '{"score": <1-10>, "critique": "<one-line>", "issues": ["<issue1>"]}'
        )

        raw = await client.generate(system_prompt=system_prompt, user_prompt=user_prompt)
        parsed = safe_parse_llm_json(raw)
        return {
            "module_id": module_id,
            "score": safe_parse_score(parsed.get("score", 0)),
            "critique": parsed.get("critique", ""),
            "issues": parsed.get("issues", []),
        }

    return asyncio.run(_run())

#Celery for validating artifacts
@celery_app.task(bind=True, max_retries=0, time_limit=180)
def validate_artifact_relevance_task(
    self,
    module_id: int,
    module_name: str,
    artifact_type: str,
    artifacts_json: list,
    prereq_summaries: dict,
) -> dict:
    async def _run():
        client = LLMClient(base_url=LLM_BASE_URL)

        prereq_context = ""
        if prereq_summaries:
            lines = [
                f"  - {pt}: score={r.get('score','?')}, critique={r.get('critique','')}"
                for pt, r in prereq_summaries.items()
            ]
            prereq_context = "\nPrerequisite Validation:\n" + "\n".join(lines)

        system_prompt = (
            "You are a software project analyst. "
            "Evaluate whether these artifacts are relevant and correct for the given module. "
            "Respond ONLY with a valid JSON object — no markdown fences."
        )
        user_prompt = (
            f"Module Name: {module_name}\n"
            f"Artifact Type: {artifact_type}\n"
            f"Count: {len(artifacts_json)}\n\n"
            f"Artifacts:\n{json.dumps(artifacts_json, indent=2)[:4000]}\n"
            f"{prereq_context}\n\n"
            "Rate relevance/correctness 1-10. Return ONLY this JSON:\n"
            '{"score": <1-10>, "critique": "<one-line>", "issues": ["<issue1>"]}'
        )

        raw = await client.generate(system_prompt=system_prompt, user_prompt=user_prompt)
        parsed = safe_parse_llm_json(raw)
        return {
            "module_id": module_id,
            "artifact_type": artifact_type,
            "score": safe_parse_score(parsed.get("score", 0)),
            "critique": parsed.get("critique", ""),
            "issues": parsed.get("issues", []),
        }

    return asyncio.run(_run())

#Celery for validating completeness
@celery_app.task(bind=True, max_retries=0, time_limit=180)
def validate_completeness_task(
    self,
    module_id: int,
    module_name: str,
    scope_section_texts: list,
    artifact_summaries: dict,
) -> dict:
    async def _run():
        client = LLMClient(base_url=LLM_BASE_URL)

        scope_combined = "\n\n".join(scope_section_texts) if scope_section_texts else "(no scope sections)"

        summary_lines = []
        for art_type, titles in artifact_summaries.items():
            preview = ", ".join(str(t) for t in titles[:5])
            suffix = f" (+{len(titles)-5} more)" if len(titles) > 5 else ""
            summary_lines.append(f"  - {art_type}: {len(titles)} items — {preview}{suffix}")
        artifact_summary_str = "\n".join(summary_lines) or "  (none)"

        system_prompt = (
            "You are a software project analyst. "
            "Evaluate whether generated artifacts fully cover the SOW requirements for this module. "
            "Identify gaps — requirements in the SOW not addressed by any artifact. "
            "Respond ONLY with a valid JSON object — no markdown fences."
        )
        user_prompt = (
            f"Module Name: {module_name}\n\n"
            f"SOW Scope/Requirements:\n{scope_combined[:3000]}\n\n"
            f"Generated Artifact Summary:\n{artifact_summary_str}\n\n"
            "Rate completeness 1-10. Return ONLY this JSON:\n"
            '{"score": <1-10>, "gaps": ["<gap1>"], "recommendations": ["<rec1>"]}'
        )

        raw = await client.generate(system_prompt=system_prompt, user_prompt=user_prompt)
        parsed = safe_parse_llm_json(raw)
        return {
            "module_id": module_id,
            "score": safe_parse_score(parsed.get("score", 0)),
            "gaps": parsed.get("gaps", []),
            "recommendations": parsed.get("recommendations", []),
        }

    return asyncio.run(_run())