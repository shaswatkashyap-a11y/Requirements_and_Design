"""
Backend test for the refine feature across all 6 artifact types.

Run from: rdstudio/backend/rdstudio/
Command:  python test_refine.py

Tests the full pipeline for each artifact type:
  content_json → labeled text → prompt → LLM → raw XML → parse_single_artifact → dict
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import asyncio
import json
from app.services.refinementOrchestrator import RefinementOrchestrator
from app.services.promptBuilder import PromptBuilder
from app.services.llmClient import LLMClient
from app.services.artifactSerializer import parse_single_artifact, render_artifact_markdown

# ── Sample data for each artifact type ────────────────────────────────────────
# Mimics what is stored in artifact.content_json in the DB.
# Each entry has the content_json and a specific feedback string to test with.

SAMPLES = {
    "functional_req": {
        "content_json": {
            "req_id":              "FR-TEST-001",
            "title":               "User Login",
            "description":         "The system shall allow users to log in using email and password.",
            "user_story":          "As a user, I want to log in so that I can access my account.",
            "acceptance_criteria": [
                "User can log in with valid credentials",
                "Failed login shows an error message",
            ],
            "priority":      "high",
            "source_section": "S1. Authentication",
        },
        "feedback": "Add a criterion: account is locked after 5 consecutive failed login attempts",
    },

    "nonfunctional_req": {
        "content_json": {
            "req_id":              "NFR-TEST-001",
            "category":            "Performance",
            "title":               "API Response Time",
            "description":         "All API endpoints must respond within acceptable time limits.",
            "measurable_criteria": "95th percentile response time under 500ms",
            "priority":            "high",
        },
        "feedback": "Change the measurable criteria to 200ms at the 99th percentile instead",
    },

    "task": {
        "content_json": {
            "task_id":              "T-TEST-001",
            "title":                "Implement JWT Authentication",
            "description":          "Build the JWT token generation and validation logic.",
            "task_type":            "task",
            "parent_task_id":       None,
            "estimated_hours":      8.0,
            "acceptance_criteria":  [
                "Tokens expire after 24 hours",
                "Refresh token flow is implemented",
            ],
            "linked_requirement_id": "FR-TEST-001",
        },
        "feedback": "Add a criterion: tokens must be invalidated on logout",
    },

    "test_case": {
        "content_json": {
            "test_id":               "TC-TEST-001",
            "title":                 "Verify successful user login",
            "linked_requirement_id": "FR-TEST-001",
            "preconditions":         ["User account exists in the system"],
            "steps": [
                "Navigate to the login page",
                "Enter valid email and password",
                "Click the login button",
            ],
            "expected_result": "User is redirected to the dashboard",
            "test_type":       "functional",
        },
        "feedback": "Add a step to verify that a success notification is shown after login",
    },

    "architecture": {
        "content_json": {
            "component_name":        "Authentication Service",
            "description":           "Handles user authentication and JWT token management.",
            "technology_suggestion": "FastAPI + python-jose",
            "interfaces":            ["POST /auth/login", "POST /auth/refresh"],
            "data_entities":         ["User", "RefreshToken"],
        },
        "feedback": "Add a POST /auth/logout interface to the interfaces list",
    },

    "risk_entry": {
        "content_json": {
            "risk_id":     "RISK-TEST-001",
            "description": "Third-party authentication provider downtime could block all logins.",
            "likelihood":  "medium",
            "impact":      "high",
            "mitigation":  "Implement a fallback to local authentication.",
            "owner":       "Platform Team",
        },
        "feedback": "Change likelihood to high and add caching of auth tokens as a second mitigation",
    },
}

# ── Shared context (mimics a real generation run) ─────────────────────────────
CONTEXT = {
    "module_name":        "User Management",
    "module_description": "Handles all user-facing authentication, session management, and access control for the customer portal.",
    "methodology":        "agile",
    "service_line_codes": [],   # add e.g. ["erp"] if your prompts dir has a matching file
}

SEPARATOR = "=" * 70


async def test_artifact_type(
    orchestrator: RefinementOrchestrator,
    prompt_builder: PromptBuilder,
    artifact_type: str,
    sample: dict,
):
    content_json = sample["content_json"]
    feedback     = sample["feedback"]

    print(f"\n{SEPARATOR}")
    print(f"ARTIFACT TYPE: {artifact_type.upper()}")
    print(SEPARATOR)

    # ── Show the content_json that would be in the DB ─────────────────────────
    print("\n[1] STORED content_json (input to prompt builder):")
    print(json.dumps(content_json, indent=2))

    # ── Show the exact prompt that goes to the LLM ───────────────────────────
    # Calls build_refinement_prompt directly so we can inspect it before sending.
    # NOTE: if you have applied the promptBuilder fix, this uses content_json.
    #       If not, replace content_json with render_artifact_markdown below.
    system_prompt, user_prompt = prompt_builder.build_refinement_prompt(
        artifact_type      = artifact_type,
        content_json       = content_json,   # ← use this after the fix
        # If fix not applied yet, swap the line above with:
        # existing_content = render_artifact_markdown(artifact_type, content_json),
        user_feedback      = feedback,
        module_name        = CONTEXT["module_name"],
        module_description = CONTEXT["module_description"],
        methodology        = CONTEXT["methodology"],
        service_line_codes = CONTEXT["service_line_codes"],
    )

    print("\n[2] SYSTEM PROMPT:")
    print(system_prompt)

    print("\n[3] USER PROMPT (sent to LLM):")
    print(user_prompt)

    # ── Call the LLM ──────────────────────────────────────────────────────────
    print(f"\n[4] CALLING LLM... (feedback: '{feedback}')")
    try:
        raw_xml, llm_meta = await orchestrator.refine_artifact(
            artifact_type      = artifact_type,
            content_json       = content_json,   # ← use this after the fix
            # existing_content = render_artifact_markdown(artifact_type, content_json),
            user_feedback      = feedback,
            module_name        = CONTEXT["module_name"],
            module_description = CONTEXT["module_description"],
            methodology        = CONTEXT["methodology"],
            service_line_codes = CONTEXT["service_line_codes"],
        )
    except Exception as e:
        print(f"  LLM CALL FAILED: {e}")
        return

    print(f"\n[5] RAW XML FROM LLM (attempts: {llm_meta['attempts']}):")
    print(raw_xml)

    # ── Parse the XML → dict ──────────────────────────────────────────────────
    print("\n[6] PARSED content_json (result of parse_single_artifact):")
    parsed = parse_single_artifact(raw_xml)
    if parsed is None:
        print("  PARSE FAILED — parse_single_artifact returned None")
        print("  Root cause: XML tags don't match _DISPATCH table in artifactSerializer.py")
        print("  Fallback stored: {'raw_xml': '...'} → card will render blank")
    else:
        print(json.dumps(parsed, indent=2))
        print("\n[7] RENDERED markdown (content_markdown that gets stored):")
        print(render_artifact_markdown(artifact_type, parsed))


async def main():
    llm            = LLMClient()
    prompt_builder = PromptBuilder()
    orchestrator   = RefinementOrchestrator(llm=llm, prompt_builder=prompt_builder)

    # Change to a list of specific types if you want to test just one:
    types_to_test = ["functional_req"]
    # types_to_test = list(SAMPLES.keys())

    for artifact_type in types_to_test:
        await test_artifact_type(
            orchestrator   = orchestrator,
            prompt_builder = prompt_builder,
            artifact_type  = artifact_type,
            sample         = SAMPLES[artifact_type],
        )

    print(f"\n{SEPARATOR}")
    print("TEST COMPLETE")
    print(SEPARATOR)


if __name__ == "__main__":
    asyncio.run(main())
