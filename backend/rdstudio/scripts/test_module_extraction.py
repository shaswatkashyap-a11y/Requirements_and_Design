"""
Smoke-test module extraction in isolation.
No Celery, no routers, no artifact generation.

Run:  python -m scripts.test_module_extraction

Before running:
  1. Make sure Ollama is running with llama3.1:8b loaded
  2. Make sure MySQL is running and has at least one SOW with classified sections
  3. Update SOW_ID below to match a real SOW in your database
"""

import asyncio
import logging
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Config ──
SOW_ID = 10  # <-- change this to a real SOW ID in your DB
METHODOLOGY = "scrum"
SERVICE_LINE_CODES = ["react", "python_dev"]

# Suppress noisy loggers
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_db_session():
    from app.config.settings import DATABASE_URL
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    return Session()


def fetch_sections(db, sow_id: int):
    from app.services.artifactRepository import ArtifactRepository
    repo = ArtifactRepository(db)
    sections = repo.get_sow_sections(sow_id)
    return sections


async def test_module_extraction():
    db = get_db_session()

    try:
        # ── Step 1: Fetch sections from DB ──
        sections = fetch_sections(db, SOW_ID)
        if not sections:
            logger.error(f"No sections found for SOW {SOW_ID}. Is it parsed and classified?")
            return

        logger.info(f"Found {len(sections)} sections for SOW {SOW_ID}")
        print("\n=== SOW SECTIONS ===")
        for s in sections:
            print(f"  ID={s['id']}  type={s['section_type']:<25}  title={s['title']}")

        # ── Step 2: Format sections with labels ──
        from app.services.generationOrchestrator import GenerationOrchestrator
        from app.services.artifactRepository import ArtifactRepository

        repo = ArtifactRepository(db)
        orchestrator = GenerationOrchestrator(repo)

        EXCLUDED_TYPES = [
            "budget_pricing",
            "terms_conditions",
            "communication",
            "appendix",
            "change_management",
        ]
        relevant = [s for s in sections if s["section_type"] not in EXCLUDED_TYPES]
        if len(relevant) < 3:
            relevant = sections

        logger.info(f"Using {len(relevant)} relevant sections (of {len(sections)} total)")

        formatted, label_map = orchestrator._format_sections_for_prompt(relevant)

        print("\n=== LABEL MAP ===")
        for label, s in label_map.items():
            print(f"  {label} -> ID={s['id']}  title={s['title']}")

        print(f"\n=== FORMATTED PROMPT (first 1000 chars) ===\n{formatted[:1000]}")

        # ── Step 3: Build the full prompt ──
        from app.services.promptBuilder import PromptBuilder

        builder = PromptBuilder()
        system_prompt, user_prompt = builder.build(
            artifact_type="module_extraction",
            methodology=METHODOLOGY,
            service_line_codes=SERVICE_LINE_CODES,
            template_vars={"sow_sections": formatted},
        )

        print(f"\n=== SYSTEM PROMPT (first 1500 chars) ===\n{system_prompt[:1500]}")
        print(f"\n=== USER PROMPT ===\n{user_prompt[:500]}")

        # ── Step 4: Call the LLM ──
        from app.services.llmClient import LLMClient

        llm = LLMClient()
        logger.info("Calling LLM for module extraction...")
        raw = await llm.generate(system_prompt, user_prompt)

        print(f"\n=== RAW LLM OUTPUT ({len(raw)} chars) ===")
        print(raw)
        print("=== END RAW OUTPUT ===")

        # ── Step 5: Parse the response ──
        from app.services.responseParser import ResponseParser

        parser = ResponseParser()
        try:
            root = parser.extract_xml(
                raw, ["modules", "FunctionalModules", "Modules", "functional_modules"]
            )
        except Exception as e:
            logger.error(f"XML parsing failed: {e}")
            print("\nParsing failed. Check the raw output above for issues.")
            return

        # ── Step 6: Extract modules and resolve source IDs ──
        import re

        modules = []
        for mod_el in root:
            name = mod_el.findtext("name") or mod_el.findtext("Name") or ""
            description = mod_el.findtext("description") or mod_el.findtext("Description") or ""
            source_raw = (
                mod_el.findtext("source_ids")
                or mod_el.findtext("SourceIds")
                or mod_el.findtext("source_sections")
                or ""
            )

            source_section_ids = []
            unresolved = []
            for token in source_raw.split(","):
                label = token.strip().upper()
                if label in label_map:
                    source_section_ids.append(label_map[label]["id"])
                elif label:
                    unresolved.append(label)

            modules.append({
                "name": name.strip(),
                "description": description.strip(),
                "source_section_ids": source_section_ids,
                "raw_source_ids": source_raw.strip(),
                "unresolved_labels": unresolved,
            })

        # ── Step 7: Print results ──
        print(f"\n=== EXTRACTED MODULES ({len(modules)}) ===")
        for i, m in enumerate(modules, 1):
            print(f"\n  Module {i}: {m['name']}")
            print(f"    Description: {m['description'][:100]}...")
            print(f"    Raw source_ids: {m['raw_source_ids']}")
            print(f"    Resolved DB IDs: {m['source_section_ids']}")
            if m["unresolved_labels"]:
                print(f"    ⚠ UNRESOLVED: {m['unresolved_labels']}")

        # ── Step 8: Coverage check ──
        all_labels = set(label_map.keys())
        used_labels = set()
        for m in modules:
            for token in m["raw_source_ids"].split(","):
                label = token.strip().upper()
                if label in all_labels:
                    used_labels.add(label)

        unused = all_labels - used_labels
        if unused:
            print(f"\n⚠ UNCOVERED SECTIONS: {sorted(unused)}")
            for label in sorted(unused):
                s = label_map[label]
                print(f"    {label} -> {s['title']} [{s['section_type']}]")
        else:
            print(f"\n✓ All {len(all_labels)} sections covered by at least one module")

        total_resolved = sum(len(m["source_section_ids"]) for m in modules)
        total_unresolved = sum(len(m["unresolved_labels"]) for m in modules)
        print(f"\n=== SUMMARY ===")
        print(f"  Modules extracted: {len(modules)}")
        print(f"  Source IDs resolved: {total_resolved}")
        print(f"  Source IDs unresolved: {total_unresolved}")
        print(f"  Section coverage: {len(used_labels)}/{len(all_labels)}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(test_module_extraction())