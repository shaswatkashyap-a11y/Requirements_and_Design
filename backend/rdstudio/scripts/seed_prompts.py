"""
One-time seed script: reads all XML prompt files from PROMPTS_DIR and
inserts them as initial rows in prompt_templates.

Run once after 'alembic upgrade head':
  python scripts/seed_prompts.py

Safe to re-run — skips rows that already exist.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import xml.etree.ElementTree as ET
from datetime import datetime
from app.db.database import SessionLocal
from app.models.promptTemplate import PromptTemplate, PromptType
from app.config.settings import PROMPTS_DIR
from app.services.promptBuilder import PromptBuilder


def _exists(db, prompt_type, artifact_type, scope_key, section) -> bool:
    """Check if a row already exists to avoid duplicate inserts on re-run."""
    return (
        db.query(PromptTemplate)
        .filter(
            PromptTemplate.prompt_type   == prompt_type,
            PromptTemplate.artifact_type == artifact_type,
            PromptTemplate.scope_key     == scope_key,
            PromptTemplate.section       == section,
        )
        .first()
    ) is not None


def _insert(db, prompt_type, artifact_type, scope_key, section, content):
    if _exists(db, prompt_type, artifact_type, scope_key, section):
        print(f"  SKIP   {prompt_type:<14} | {str(artifact_type):<20} | {str(scope_key):<15} | {section}")
        return
    db.add(PromptTemplate(
        prompt_type   = prompt_type,
        artifact_type = artifact_type,
        scope_key     = scope_key,
        section       = section,
        content       = content,
        is_active     = True,
        created_at    = datetime.utcnow(),
        updated_at    = datetime.utcnow(),
    ))
    print(f"  INSERT {prompt_type:<14} | {str(artifact_type):<20} | {str(scope_key):<15} | {section}")


def seed_base_templates(db):
    """
    base/{artifact_type}.xml has two sections: <system> and <user>.
    Each becomes its own row keyed by artifact_type + section.
    """
    base_dir = os.path.join(PROMPTS_DIR, "base")
    if not os.path.exists(base_dir):
        print("  base dir not found, skipping")
        return
    for fname in os.listdir(base_dir):
        if not fname.endswith(".xml"):
            continue
        artifact_type = fname.replace(".xml", "")
        root = ET.parse(os.path.join(base_dir, fname)).getroot()
        system = root.findtext("system", default="")
        user   = root.findtext("user",   default="")
        if system:
            _insert(db, PromptType.BASE, artifact_type, None, "system", system)
        if user:
            _insert(db, PromptType.BASE, artifact_type, None, "user",   user)


def seed_methodology_templates(db):
    """
    methodology/{methodology}.xml has:
      <global_instructions> — applies to all artifact types for this methodology
      <artifact_overrides>
        <functional_req>...</functional_req>  — artifact-specific override
        ...
    Each becomes its own row.
    """
    meth_dir = os.path.join(PROMPTS_DIR, "methodology")
    if not os.path.exists(meth_dir):
        print("  methodology dir not found, skipping")
        return
    for fname in os.listdir(meth_dir):
        if not fname.endswith(".xml"):
            continue
        methodology = fname.replace(".xml", "")
        root = ET.parse(os.path.join(meth_dir, fname)).getroot()
        global_inst = root.findtext("global_instructions", default="")
        if global_inst.strip():
            _insert(db, PromptType.METHODOLOGY, None, methodology, "global_instructions", global_inst.strip())
        overrides_el = root.find("artifact_overrides")
        if overrides_el is not None:
            for child in overrides_el:
                if child.text and child.text.strip():
                    _insert(db, PromptType.METHODOLOGY, child.tag, methodology, "artifact_override", child.text.strip())


def seed_service_line_templates(db):
    """
    service_line/{code}.xml has:
      <tech_context>  — domain-specific instructions
      <artifact_overrides>
        <functional_req>...</functional_req>
    """
    sl_dir = os.path.join(PROMPTS_DIR, "service_line")
    if not os.path.exists(sl_dir):
        print("  service_line dir not found, skipping")
        return
    for fname in os.listdir(sl_dir):
        if not fname.endswith(".xml"):
            continue
        sl_code = fname.replace(".xml", "")
        root = ET.parse(os.path.join(sl_dir, fname)).getroot()
        tech_ctx = root.findtext("tech_context", default="")
        if tech_ctx.strip():
            _insert(db, PromptType.SERVICE_LINE, None, sl_code, "tech_context", tech_ctx.strip())
        overrides_el = root.find("artifact_overrides")
        if overrides_el is not None:
            for child in overrides_el:
                if child.text and child.text.strip():
                    _insert(db, PromptType.SERVICE_LINE, child.tag, sl_code, "artifact_override", child.text.strip())


def seed_examples(db):
    """examples/{methodology}/{artifact_type}_example.xml — raw file content."""
    examples_dir = os.path.join(PROMPTS_DIR, "examples")
    if not os.path.exists(examples_dir):
        print("  examples dir not found, skipping")
        return
    for methodology in os.listdir(examples_dir):
        meth_path = os.path.join(examples_dir, methodology)
        if not os.path.isdir(meth_path):
            continue
        for fname in os.listdir(meth_path):
            if not fname.endswith("_example.xml"):
                continue
            artifact_type = fname.replace("_example.xml", "")
            with open(os.path.join(meth_path, fname), "r") as f:
                content = f.read()
            _insert(db, PromptType.EXAMPLE, artifact_type, methodology, "content", content)


def seed_refinement_prompts(db):
    """
    The refinement system and user template are hardcoded constants in PromptBuilder.
    Seeding them into DB makes them editable via the UI like everything else.
    """
    _insert(db, PromptType.REFINEMENT, None, None, "system", PromptBuilder._REFINEMENT_SYSTEM)
    _insert(db, PromptType.REFINEMENT, None, None, "user",   PromptBuilder._REFINEMENT_USER_TEMPLATE)


def seed_refinement_schemas(db):
    """
    refinement_schemas/{artifact_type}.xml — raw XML output schema used as the
    {output_schema} placeholder in refinement prompts. Stored as section="schema".
    """
    schema_dir = os.path.join(PROMPTS_DIR, "refinement_schemas")
    if not os.path.exists(schema_dir):
        print("  refinement_schemas dir not found, skipping")
        return
    for fname in os.listdir(schema_dir):
        if not fname.endswith(".xml"):
            continue
        artifact_type = fname.replace(".xml", "")
        fpath = os.path.join(schema_dir, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read().strip()
        if content:
            _insert(db, PromptType.REFINEMENT, artifact_type, None, "schema", content)


def main():
    db = SessionLocal()
    try:
        print("\n── Base templates ──────────────────────────")
        seed_base_templates(db)
        print("\n── Methodology templates ───────────────────")
        seed_methodology_templates(db)
        print("\n── Service line templates ──────────────────")
        seed_service_line_templates(db)
        print("\n── Examples ────────────────────────────────")
        seed_examples(db)
        print("\n── Refinement prompts ──────────────────────")
        seed_refinement_prompts(db)
        print("\n── Refinement schemas ──────────────────────")
        seed_refinement_schemas(db)
        db.commit()
        print("\nSeed complete.\n")
    except Exception as e:
        db.rollback()
        print(f"\nSeed FAILED: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
