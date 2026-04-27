"""
Test all artifact types for a single module.
Runs: module extraction → functional_req → nonfunctional_req → risk_entry
      → task → test_case → architecture

Run:  python -m scripts.test_all_artifacts
"""

import asyncio
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.database import DATABASE_URL
from app.services.artifactRepository import ArtifactRepository
from app.services.generationOrchestrator import GenerationOrchestrator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# ── Config ──
SOW_ID = 5
METHODOLOGY = "scrum"
SERVICE_LINE_CODES = ["react", "python_dev"]

# Round 1: no dependencies — these run first
# Round 2: depend on functional_req and/or nonfunctional_req
ARTIFACT_TYPES_TO_TEST = [
    "functional_req",
    "nonfunctional_req",
    "risk_entry",
    "task",
    "test_case",
    "architecture",
]


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

        # ── Step 2: Extract modules ──
        logger.info("Extracting modules...")
        modules_data = await orchestrator._extract_modules(
            sections, METHODOLOGY, SERVICE_LINE_CODES
        )

        print(f"\n{'='*60}")
        print(f"EXTRACTED MODULES ({len(modules_data)})")
        print(f"{'='*60}")
        for i, m in enumerate(modules_data, 1):
            print(f"  {i}. {m['name']}")

        # ── Step 3: Pick a test module ──
        test_module = None
        skip_words = [
            "exclusion", "staff augmentation", "change management",
            "project management", "governance", "team collaboration",
        ]
        for m in modules_data:
            if not any(s in m["name"].lower() for s in skip_words):
                test_module = m
                break
        if not test_module:
            test_module = modules_data[0]

        print(f"\nTesting module: {test_module['name']}")
        print(f"  Description: {test_module['description']}")

        # ── Step 4: Get relevant sections ──
        relevant = orchestrator._get_relevant_sections(test_module, sections)
        print(f"  Relevant sections: {len(relevant)}")

        # ── Step 5: Generate each artifact type sequentially ──
        prerequisite_artifacts = {}
        results_summary = []

        for art_type in ARTIFACT_TYPES_TO_TEST:
            print(f"\n{'='*60}")
            print(f"GENERATING: {art_type}")
            print(f"{'='*60}")

            try:
                parsed = await orchestrator._generate_single_artifact(
                    artifact_type=art_type,
                    module=test_module,
                    relevant_sections=relevant,
                    methodology=METHODOLOGY,
                    service_line_codes=SERVICE_LINE_CODES,
                    prerequisite_artifacts=prerequisite_artifacts,
                )

                # store results for downstream artifacts
                prerequisite_artifacts[art_type] = parsed

                print(f"  ✓ Parsed {len(parsed)} items")

                # print summary for each item
                for item in parsed[:3]:  # show first 3
                    item_id = (
                        item.get("req_id")
                        or item.get("task_id")
                        or item.get("test_id")
                        or item.get("risk_id")
                        or item.get("component_name")
                        or "?"
                    )
                    title = item.get("title", item.get("description", "")[:60])
                    print(f"    - [{item_id}] {title}")

                if len(parsed) > 3:
                    print(f"    ... and {len(parsed) - 3} more")

                # test markdown rendering
                if parsed:
                    md = orchestrator._render_markdown(parsed[0], art_type)
                    print(f"  ✓ Markdown renders ({len(md)} chars)")

                # test DB format conversion
                db_artifacts = orchestrator._convert_to_db_format(
                    parsed, art_type, METHODOLOGY
                )
                print(f"  ✓ DB format ready ({len(db_artifacts)} artifacts)")

                results_summary.append((art_type, len(parsed), "✓"))

            except Exception as e:
                logger.error(f"FAILED: {art_type} — {e}")
                results_summary.append((art_type, 0, f"✗ {e}"))

                # still try to continue — some downstream types might
                # work with whatever prereqs we have so far

        # ── Step 6: Final summary ──
        print(f"\n{'='*60}")
        print("SUMMARY")
        print(f"{'='*60}")
        print(f"  Module: {test_module['name']}")
        print(f"  Methodology: {METHODOLOGY}")
        print(f"  Service lines: {SERVICE_LINE_CODES}")
        print()

        total_ok = 0
        total_items = 0
        for art_type, count, status in results_summary:
            print(f"  {status} {art_type:<25} → {count} items")
            if status == "✓":
                total_ok += 1
                total_items += count

        print(f"\n  {total_ok}/{len(ARTIFACT_TYPES_TO_TEST)} artifact types succeeded")
        print(f"  {total_items} total items generated")

        # ── Step 7: Validate downstream linking ──
        if "task" in prerequisite_artifacts and "functional_req" in prerequisite_artifacts:
            print(f"\n{'='*60}")
            print("TRACEABILITY CHECK")
            print(f"{'='*60}")

            fr_ids = {r["req_id"] for r in prerequisite_artifacts["functional_req"]}

            tasks_linked = 0
            tasks_unlinked = 0
            for t in prerequisite_artifacts.get("task", []):
                linked = t.get("linked_requirement_id", "")
                if linked in fr_ids:
                    tasks_linked += 1
                else:
                    tasks_unlinked += 1
                    print(f"  ⚠ Task {t.get('task_id')} links to '{linked}' — not in FR IDs")

            print(f"  Tasks linked to valid FRs: {tasks_linked}")
            print(f"  Tasks with broken links: {tasks_unlinked}")

            tc_linked = 0
            tc_unlinked = 0
            for tc in prerequisite_artifacts.get("test_case", []):
                linked = tc.get("linked_requirement_id", "")
                if linked in fr_ids:
                    tc_linked += 1
                else:
                    tc_unlinked += 1
                    print(f"  ⚠ Test {tc.get('test_id')} links to '{linked}' — not in FR IDs")

            print(f"  Test cases linked to valid FRs: {tc_linked}")
            print(f"  Test cases with broken links: {tc_unlinked}")

    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())