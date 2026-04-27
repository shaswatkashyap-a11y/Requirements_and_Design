"""
Test functional requirements generation for a single module.
Runs module extraction first, then picks the first module and generates FRs.

Run:  python -m scripts.test_functional_req

Before running:
  - Ollama running with llama3.1:8b
  - MySQL running with a parsed/classified SOW
  - Update SOW_ID below
"""

import asyncio
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import DATABASE_URL
from app.services.artifactRepository import ArtifactRepository
from app.services.generationOrchestrator import GenerationOrchestrator

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# ── Config ──
SOW_ID = 5
METHODOLOGY = "scrum"
SERVICE_LINE_CODES = ["react", "python_dev"]


def get_db_session():
    engine = create_engine(DATABASE_URL)
    return sessionmaker(bind=engine)()


async def main():
    db = get_db_session()

    try:
        repo = ArtifactRepository(db)
        orchestrator = GenerationOrchestrator(repo)

        # ── Step 1: Fetch sections ──
        sections = repo.get_sow_sections(SOW_ID)
        if not sections:
            logger.error(f"No sections found for SOW {SOW_ID}")
            return

        logger.info(f"Found {len(sections)} sections")

        # ── Step 2: Extract modules (reuse proven logic) ──
        logger.info("Extracting modules...")
        modules_data = await orchestrator._extract_modules(
            sections, METHODOLOGY, SERVICE_LINE_CODES
        )

        print(f"\n=== EXTRACTED MODULES ({len(modules_data)}) ===")
        for i, m in enumerate(modules_data, 1):
            print(f"  {i}. {m['name']} (sources: {m['source_section_ids']})")

        # ── Step 3: Pick a module to test ──
        # Pick the first non-trivial module (skip things like "Exclusions")
        test_module = None
        for m in modules_data:
            name_lower = m["name"].lower()
            if not any(skip in name_lower for skip in [
                "exclusion", "staff augmentation", "change management",
                "project management", "governance"
            ]):
                test_module = m
                break

        if not test_module:
            test_module = modules_data[0]

        print(f"\n=== TESTING MODULE: {test_module['name']} ===")
        print(f"  Description: {test_module['description']}")
        print(f"  Source section IDs: {test_module['source_section_ids']}")

        # ── Step 4: Get relevant sections for this module ──
        relevant = orchestrator._get_relevant_sections(test_module, sections)
        print(f"  Relevant sections: {len(relevant)}")
        for s in relevant:
            print(f"    - {s['title']} [{s['section_type']}]")

        # ── Step 5: Generate functional requirements ──
        module_prefix = test_module["name"][:3].upper().replace(" ", "")
        formatted_sections, _ = orchestrator._format_sections_for_prompt(relevant)

        template_vars = {
            "module_name": test_module["name"],
            "module_description": test_module.get("description", ""),
            "module_prefix": module_prefix,
            "relevant_sections": formatted_sections,
        }

        system_prompt, user_prompt = orchestrator.prompt_builder.build(
            artifact_type="functional_req",
            methodology=METHODOLOGY,
            service_line_codes=SERVICE_LINE_CODES,
            template_vars=template_vars,
        )

        print(f"\n=== SYSTEM PROMPT (first 1000 chars) ===\n{system_prompt[:1000]}")
        print(f"\n=== USER PROMPT ===\n{user_prompt[:800]}")

        logger.info("Calling LLM for functional requirements...")
        raw = await orchestrator.llm.generate(system_prompt, user_prompt)

        print(f"\n=== RAW LLM OUTPUT ({len(raw)} chars) ===")
        print(raw)
        print("=== END RAW OUTPUT ===")

        # ── Step 6: Parse the response ──
        try:
            parsed = orchestrator._parse_artifact_response(raw, "functional_req")
        except Exception as e:
            logger.error(f"Parsing failed: {e}")
            print("\nCheck the raw output above for XML issues.")
            return

        print(f"\n=== PARSED REQUIREMENTS ({len(parsed)}) ===")
        for req in parsed:
            print(f"\n  {req.get('req_id', '???')} — {req.get('title', '???')}")
            print(f"    Description: {req.get('description', '')[:120]}...")
            print(f"    User story: {req.get('user_story', 'N/A')}")
            print(f"    Priority: {req.get('priority', '???')}")
            print(f"    Source section: {req.get('source_section', 'N/A')}")
            ac = req.get("acceptance_criteria", [])
            if ac:
                print(f"    Acceptance criteria ({len(ac)}):")
                for c in ac:
                    print(f"      - {c}")

        # ── Step 7: Test markdown rendering ──
        print(f"\n=== MARKDOWN RENDER (first requirement) ===")
        if parsed:
            md = orchestrator._render_markdown(parsed[0], "functional_req")
            print(md)

        # ── Step 8: Test DB format conversion ──
        db_artifacts = orchestrator._convert_to_db_format(
            parsed, "functional_req", METHODOLOGY
        )
        print(f"\n=== DB FORMAT ({len(db_artifacts)} artifacts ready to save) ===")
        for a in db_artifacts[:3]:
            print(f"  type={a['artifact_type']}  title={a['title']}")
            print(f"  source_section_ids={a.get('source_section_ids')}")
            print(f"  content_json keys: {list(a['content_json'].keys())}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())