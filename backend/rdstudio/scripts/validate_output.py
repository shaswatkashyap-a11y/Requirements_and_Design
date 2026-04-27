"""
Validation orchestrator for a completed generation run.
Usage (from backend/rdstudio/):
    python -m scripts.validate_output --run_id <id>
"""

import argparse
import json
import logging

from app.db.database import SessionLocal
from app.models.generationRun import GenerationRun
from app.models.sow import Sow, SOWSection
from app.models.module import Module
from app.models.artifact import Artifact

logging.basicConfig(level=logging.WARNING)

# ── CONFIG ────────────────────────────────────────────────────────────────────
SCORE_THRESHOLD_WARN = 6.0   # below this = WARNING
SCORE_THRESHOLD_FAIL = 4.0   # below this = FAIL
CELERY_RESULT_TIMEOUT = 120  # seconds to wait per task result

SCOPE_SECTION_TYPES = {"scope", "requirements", "deliverables", "objectives", "assumptions"}

# IDs embedded inside content_json per artifact type
ARTIFACT_ID_FIELD = {
    "functional_req":     "req_id",
    "nonfunctional_req":  "req_id",
    "epic":               "epic_id",
    "user_story":         "story_id",
    "task":               "task_id",
    "test_case":          "test_id",
    "risk_entry":         "risk_id",
    "architecture":       "id",
    "component_design":   "id",
    "data_model":         "id",
    "traceability_matrix": "id",
}

# ── PHASE 1: fetch run data ───────────────────────────────────────────────────
# Loads all data needed for validation in one DB pass.
# Returns a dict with the run, sow, all sow sections, all modules,
# and artifacts grouped by module_id → artifact_type → list[Artifact].
def fetch_run_data(run_id: int, db) -> dict:
    run = db.query(GenerationRun).get(run_id)
    if not run:
        raise ValueError(f"GenerationRun {run_id} not found")

    sow = db.query(Sow).get(run.sow_id)
    if not sow:
        raise ValueError(f"Sow {run.sow_id} not found")

    sow_sections = (
        db.query(SOWSection)
        .filter(SOWSection.sow_id == sow.id)
        .order_by(SOWSection.section_order)
        .all()
    )

    modules = (
        db.query(Module)
        .filter(Module.generation_run_id == run_id)
        .order_by(Module.module_order)
        .all()
    )

    artifacts_by_module = {}
    for module in modules:
        rows = db.query(Artifact).filter(Artifact.module_id == module.id).all()
        grouped = {}
        for art in rows:
            grouped.setdefault(art.artifact_type, []).append(art)
        artifacts_by_module[module.id] = grouped

    return {
        "run": run,
        "sow": sow,
        "sow_sections": sow_sections,
        "modules": modules,
        "artifacts_by_module": artifacts_by_module,
    }

# ── PHASE 2: shared utilities ─────────────────────────────────────────────────
# Filters the full SOW section list down to only those whose id
# appears in section_ids. Used to get the source sections a module was derived from.
def get_sections_by_ids(section_ids: list, all_sections: list) -> list:
    id_set = set(section_ids or [])
    return [s for s in all_sections if s.id in id_set]

# Filters the full SOW section list by section_type field (e.g. "scope", "requirements").
# Used in Phase 7 to find scope sections for the completeness prompt.
def get_sections_by_type(section_types: list, all_sections: list) -> list:
    type_set = set(t.lower() for t in section_types)
    return [s for s in all_sections if (s.section_type or "").lower() in type_set]

# Concatenates a list of SOW sections into a single string with title headers.
# Used to build the text block injected into LLM prompts.
def format_sections_for_prompt(sections: list) -> str:
    parts = []
    for s in sections:
        parts.append(f"### {s.title}\n{s.content or ''}")
    return "\n\n".join(parts)

# Extracts content_json dicts from a list of Artifact objects.
# Skips artifacts with null content_json to avoid sending empty data to the LLM.
def format_artifacts_for_prompt(artifacts: list) -> list:
    return [a.content_json for a in artifacts if a.content_json]

# Safely converts an LLM score output to float.
# Returns 0.0 if the value is None, a string, or unparseable — prevents crashes on bad LLM output.
def safe_parse_score(val) -> float:
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0
    
# ── PHASE 3: structure check (pure Python, no LLM) ───────────────────────────
# Pure Python check — no LLM, no Celery.
# Verifies every module has artifacts, every artifact has content_json and content_markdown,
# and there are no duplicate IDs within the same module + artifact type.
def validate_structure(data: dict) -> dict:
    issues = []

    for module in data["modules"]:
        arts = data["artifacts_by_module"].get(module.id, {})

        if not arts:
            issues.append(f"Module '{module.name}' has no artifacts")
            continue

        seen_ids: dict = {}  # (module_id, art_type, id_value) → artifact.id

        for art_type, items in arts.items():
            id_field = ARTIFACT_ID_FIELD.get(art_type)

            for artifact in items:
                if not artifact.content_json:
                    issues.append(
                        f"Artifact {artifact.id} ({art_type}) in module '{module.name}' "
                        f"has empty content_json"
                    )
                if not artifact.content_markdown:
                    issues.append(
                        f"Artifact {artifact.id} ({art_type}) in module '{module.name}' "
                        f"has empty content_markdown"
                    )

                if id_field and artifact.content_json:
                    id_val = artifact.content_json.get(id_field)
                    if id_val:
                        key = (module.id, art_type, str(id_val))
                        if key in seen_ids:
                            issues.append(
                                f"Module '{module.name}': duplicate {id_field}='{id_val}' "
                                f"in {art_type} (artifacts {seen_ids[key]} and {artifact.id})"
                            )
                        else:
                            seen_ids[key] = artifact.id

    return {"issues": issues, "passed": len(issues) == 0}

# ── PHASE 4: traceability check (pure Python, no LLM) ────────────────────────

ROUND2_TYPES = {"epic", "user_story", "task", "test_case", "architecture",
                "component_design", "data_model", "traceability_matrix"}
LINK_FIELD = "linked_requirement_id"
# Pure Python check — no LLM, no Celery.
# For each Round 2 artifact (task, test_case, epic, etc.), checks that its
# linked_requirement_id points to a real functional_req req_id in the same module.
# Counts total links checked and how many are broken.
def validate_traceability(data: dict) -> dict:
    issues = []
    total_links = 0
    broken_links = 0

    for module in data["modules"]:
        arts = data["artifacts_by_module"].get(module.id, {})

        fr_ids = set()
        for artifact in arts.get("functional_req", []):
            if artifact.content_json:
                rid = artifact.content_json.get("req_id")
                if rid:
                    fr_ids.add(str(rid))

        for art_type in ROUND2_TYPES:
            for artifact in arts.get(art_type, []):
                if not artifact.content_json:
                    continue
                linked = artifact.content_json.get(LINK_FIELD)
                if linked is None:
                    continue
                total_links += 1
                if str(linked) not in fr_ids:
                    broken_links += 1
                    issues.append(
                        f"Module '{module.name}': {art_type} artifact {artifact.id} "
                        f"links to '{linked}' which is not a valid functional_req req_id"
                    )

    return {
        "issues": issues,
        "broken_links": broken_links,
        "total_links_checked": total_links,
        "passed": broken_links == 0,
    }

# ── PHASE 5: module relevance (Celery fan-out) ────────────────────────────────
# Phase 5 — dispatches one Celery task per module in parallel.
# Each task asks the LLM whether the module is relevant to its source SOW sections.
# Blocks until all tasks return, then returns the full list of results.
def run_module_relevance(data: dict) -> list:
    from app.tasks.validationTask import validate_module_relevance_task

    tasks = []
    for module in data["modules"]:
        source_sections = get_sections_by_ids(
            module.source_section_ids or [], data["sow_sections"]
        )
        section_texts = [s.content for s in source_sections if s.content]
        tasks.append(
            validate_module_relevance_task.delay(
                module_id=module.id,
                module_name=module.name,
                module_desc=module.description or "",
                section_texts=section_texts,
            )
        )

    return [t.get(timeout=CELERY_RESULT_TIMEOUT) for t in tasks]

# ── PHASE 6: artifact relevance (two rounds, parallel within each) ────────────
# Phase 6 — validates artifacts in two sequential rounds mirroring generation order.
# Round 1: functional_req, nonfunctional_req, risk_entry (no dependencies).
# Round 2: task, test_case, epic, architecture, etc. (depend on Round 1).
# Within each round all modules and types are dispatched to Celery in parallel.
# Round 1 results are passed as prereq_summaries context to Round 2 tasks.
def run_artifact_relevance(data: dict) -> list:
    from app.tasks.validationTask import validate_artifact_relevance_task
    from app.config.artifact_dependencies import resolve_generation_order

    all_types = set()
    for arts in data["artifacts_by_module"].values():
        all_types.update(arts.keys())

    if not all_types:
        return []

    rounds = resolve_generation_order(list(all_types))
    all_results = []
    round1_results_by_module: dict = {}

    for round_num, round_types in enumerate(rounds):
        tasks = []
        task_keys = []

        for module in data["modules"]:
            arts = data["artifacts_by_module"].get(module.id, {})
            prereq_summaries = round1_results_by_module.get(module.id, {})

            for art_type in round_types:
                if art_type not in arts:
                    continue
                artifacts_json = [
                    a.content_json for a in arts[art_type] if a.content_json
                ]
                tasks.append(
                    validate_artifact_relevance_task.delay(
                        module_id=module.id,
                        module_name=module.name,
                        artifact_type=art_type,
                        artifacts_json=artifacts_json,
                        prereq_summaries=prereq_summaries,
                    )
                )
                task_keys.append((module.id, art_type))

        results = [t.get(timeout=CELERY_RESULT_TIMEOUT) for t in tasks]
        all_results.extend(results)

        if round_num == 0:
            for (mod_id, art_type), res in zip(task_keys, results):
                round1_results_by_module.setdefault(mod_id, {})[art_type] = res

    return all_results

# ── PHASE 7: completeness (Celery fan-out) ────────────────────────────────────
# Phase 7 — dispatches one Celery task per module in parallel.
# Each task asks the LLM whether the generated artifacts fully cover
# the SOW scope/requirements sections, and identifies any gaps.
# Blocks until all tasks return, then returns the full list of results.
def run_completeness(data: dict) -> list:
    from app.tasks.validationTask import validate_completeness_task

    scope_sections = get_sections_by_type(list(SCOPE_SECTION_TYPES), data["sow_sections"])
    scope_texts = [s.content for s in scope_sections if s.content]

    tasks = []
    for module in data["modules"]:
        arts = data["artifacts_by_module"].get(module.id, {})

        artifact_summaries = {}
        for art_type, items in arts.items():
            id_field = ARTIFACT_ID_FIELD.get(art_type, "title")
            artifact_summaries[art_type] = [
                a.content_json.get("title")
                or a.content_json.get(id_field)
                or "?"
                for a in items
                if a.content_json
            ]

        tasks.append(
            validate_completeness_task.delay(
                module_id=module.id,
                module_name=module.name,
                scope_section_texts=scope_texts,
                artifact_summaries=artifact_summaries,
            )
        )

    return [t.get(timeout=CELERY_RESULT_TIMEOUT) for t in tasks]

# ── PHASE 8: aggregate and report ─────────────────────────────────────────────
# Converts a numeric score to a PASS / WARN / FAIL label
# based on the SCORE_THRESHOLD_WARN and SCORE_THRESHOLD_FAIL config values.
def score_label(score: float) -> str:
    if score >= SCORE_THRESHOLD_WARN:
        return "PASS"
    if score >= SCORE_THRESHOLD_FAIL:
        return "WARN"
    return "FAIL"

# Phase 8 — takes results from all validation phases and prints the full report.
# Sections: run summary, structure check, traceability check, module relevance table,
# artifact relevance table per module, completeness table, overall score,
# and a recommended actions list for anything scoring below threshold.
def aggregate_and_report(structure, traceability, module_relevance, artifact_relevance, completeness, data):
    run = data["run"]
    sow = data["sow"]
    modules = data["modules"]
    module_map = {m.id: m for m in modules}

    total_artifacts = sum(
        len(items)
        for arts in data["artifacts_by_module"].values()
        for items in arts.values()
    )

    sep = "=" * 70

    # ── Run summary ──
    print(sep)
    print(f"  VALIDATION REPORT")
    print(sep)
    print(f"  Run ID     : {run.id}")
    print(f"  SOW        : {sow.filename}")
    print(f"  Methodology: {run.methodology}")
    print(f"  Modules    : {len(modules)}")
    print(f"  Artifacts  : {total_artifacts}")
    print(f"  Run Status : {run.status}")
    print()

    # ── Structure check ──
    struct_label = "PASS" if structure["passed"] else "FAIL"
    print(f"[{struct_label}] Structure Check")
    if structure["issues"]:
        for issue in structure["issues"]:
            print(f"       - {issue}")
    else:
        print("       No structural issues found.")
    print()

    # ── Traceability check ──
    trace_label = "PASS" if traceability["passed"] else "FAIL"
    checked = traceability["total_links_checked"]
    broken = traceability["broken_links"]
    print(f"[{trace_label}] Traceability Check  ({broken} broken / {checked} links checked)")
    if traceability["issues"]:
        for issue in traceability["issues"]:
            print(f"       - {issue}")
    else:
        print("       All cross-references are valid.")
    print()

    # ── Module relevance ──
    print(f"{'Module Relevance':─<70}")
    print(f"  {'Module':<35} {'Score':>6}  {'Label':<6}  Critique")
    print(f"  {'─'*35} {'─'*6}  {'─'*6}  {'─'*30}")
    mod_scores = []
    for r in module_relevance:
        mod = module_map.get(r["module_id"])
        name = mod.name if mod else f"id={r['module_id']}"
        label = score_label(r["score"])
        mod_scores.append(r["score"])
        print(f"  {name:<35} {r['score']:>6.1f}  {label:<6}  {r['critique']}")
    print()

    # ── Artifact relevance ──
    print(f"{'Artifact Relevance':─<70}")
    art_scores = []
    art_by_module: dict = {}
    for r in artifact_relevance:
        art_by_module.setdefault(r["module_id"], []).append(r)

    for module in modules:
        results = art_by_module.get(module.id, [])
        if not results:
            continue
        print(f"  Module: {module.name}")
        print(f"    {'Artifact Type':<25} {'Score':>6}  {'Label':<6}  Top Issues")
        print(f"    {'─'*25} {'─'*6}  {'─'*6}  {'─'*30}")
        for r in results:
            label = score_label(r["score"])
            art_scores.append(r["score"])
            print(f"    {r['artifact_type']:<25} {r['score']:>6.1f}  {label:<6}  {r['critique']}")
            if r["issues"]:
                for issue in r["issues"]:
                    print(f"         - {str(issue)}")
    print()                

    # ── Completeness ──
    print(f"{'Completeness':─<70}")
    print(f"  {'Module':<35} {'Score':>6}  {'Label':<6}  Gaps  Top Gap")
    print(f"  {'─'*35} {'─'*6}  {'─'*6}  {'─'*4}  {'─'*30}")
    comp_scores = []
    for r in completeness:
        mod = module_map.get(r["module_id"])
        name = mod.name if mod else f"id={r['module_id']}"
        label = score_label(r["score"])
        comp_scores.append(r["score"])
        print(f"  {name:<35} {r['score']:>6.1f}  {label:<6}  {len(r['gaps']):>4}")
        if r["gaps"]:
            for gap in r["gaps"]:
                print(f"       GAP: {str(gap)}")
        if r["recommendations"]:
            for rec in r["recommendations"]:
                print(f"       REC: {str(rec)}")
    print()

    # ── Overall score ──
    all_llm_scores = mod_scores + art_scores + comp_scores
    if all_llm_scores:
        overall = sum(all_llm_scores) / len(all_llm_scores)
    else:
        overall = 0.0
    overall_label = score_label(overall)

    print(sep)
    print(f"  OVERALL SCORE: {overall:.2f} / 10   [{overall_label}]")
    print(sep)
    print()

    # ── Recommended actions ──
    print("Recommended Actions (items scoring below threshold):")
    has_actions = False

    for r in module_relevance:
        if r["score"] < SCORE_THRESHOLD_WARN:
            mod = module_map.get(r["module_id"])
            name = mod.name if mod else f"id={r['module_id']}"
            print(f"\n  [Module Relevance] '{name}' — score {r['score']:.1f}")
            for issue in r["issues"]:
                print(f"    - {issue}")
            has_actions = True

    for r in artifact_relevance:
        if r["score"] < SCORE_THRESHOLD_WARN:
            mod = module_map.get(r["module_id"])
            name = mod.name if mod else f"id={r['module_id']}"
            print(f"\n  [Artifact Relevance] '{name}' / {r['artifact_type']} — score {r['score']:.1f}")
            for issue in r["issues"]:
                print(f"    - {issue}")
            has_actions = True

    for r in completeness:
        if r["score"] < SCORE_THRESHOLD_WARN:
            mod = module_map.get(r["module_id"])
            name = mod.name if mod else f"id={r['module_id']}"
            print(f"\n  [Completeness] '{name}' — score {r['score']:.1f}")
            for gap in r["gaps"]:
                print(f"    GAP: {gap}")
            for rec in r["recommendations"]:
                print(f"    REC: {rec}")
            has_actions = True

    if not has_actions:
        print("  None — all scores above threshold.")
    print()

# ── PHASE 9: main ─────────────────────────────────────────────────────────────
#Orchestrator
#Runs all the function in sequence for validaiton upon being called
def run_validation(run_id: int, db):
    # accepts db from outside instead of creating its own
    data = fetch_run_data(run_id, db)
    structure    = validate_structure(data)
    traceability = validate_traceability(data)
    mod_relevance  = run_module_relevance(data)
    art_relevance  = run_artifact_relevance(data)
    completeness   = run_completeness(data)
    return structure, traceability, mod_relevance, art_relevance, completeness, data

# Phase 9 — entry point
#Creates a db session and calls the orchestrator
#After getting the results, closes the db connection
def main():
    parser = argparse.ArgumentParser(description="Validate a completed generation run.")
    parser.add_argument("--run_id", type=int, required=True, help="GenerationRun ID to validate")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        structure, traceability, mod_relevance, art_relevance, completeness, data = run_validation(args.run_id, db)
        aggregate_and_report(structure, traceability, mod_relevance, art_relevance, completeness, data)
    finally:
        db.close()

if __name__ == "__main__":
    main()