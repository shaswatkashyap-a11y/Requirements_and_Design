"""
Shared XML → dict parsing and dict → markdown rendering for all artifact types.
Used by both GenerationOrchestrator (bulk) and RefinementService (single artifact).
"""
import xml.etree.ElementTree as ET

# Maps the refinement XML root tag → (child element tag, parse function)
_PARSE_MAP: dict[str, tuple[str, callable]] = {}


# ── Parse functions ────────────────────────────────────────────────────────────

def _parse_functional_req(el: ET.Element) -> dict:
    return {
        "req_id":               el.findtext("req_id", "").strip(),
        "title":                el.findtext("title", "").strip(),
        "description":          el.findtext("description", "").strip(),
        "user_story":           el.findtext("user_story"),
        "acceptance_criteria":  [
            c.text.strip() for c in el.findall("acceptance_criteria/criterion") if c.text
        ],
        "priority":             el.findtext("priority", "medium").strip(),
        "source_section":       el.findtext("source_section"),
    }

def _parse_nfr(el: ET.Element) -> dict:
    return {
        "req_id":              el.findtext("req_id", "").strip(),
        "category":            el.findtext("category", "").strip(),
        "title":               el.findtext("title", "").strip(),
        "description":         el.findtext("description", "").strip(),
        "measurable_criteria": el.findtext("measurable_criteria"),
        "priority":            el.findtext("priority", "medium").strip(),
    }

def _parse_task(el: ET.Element) -> dict:
    return {
        "task_id":              el.findtext("task_id", "").strip(),
        "title":                el.findtext("title", "").strip(),
        "description":          el.findtext("description", "").strip(),
        "task_type":            el.findtext("task_type", "task").strip(),
        "parent_task_id":       el.findtext("parent_task_id"),
        "estimated_hours":      (
            float(el.findtext("estimated_hours", "0") or "0") or None
        ),
        "acceptance_criteria":  [
            c.text.strip() for c in el.findall("acceptance_criteria/criterion") if c.text
        ],
        "linked_requirement_id": el.findtext("linked_requirement_id"),
    }

def _parse_test_case(el: ET.Element) -> dict:
    return {
        "test_id":              el.findtext("test_id", "").strip(),
        "title":                el.findtext("title", "").strip(),
        "linked_requirement_id": el.findtext("linked_requirement_id", "").strip(),
        "preconditions":        [
            p.text.strip() for p in el.findall("preconditions/precondition") if p.text
        ],
        "steps":                [
            s.text.strip() for s in el.findall("steps/step") if s.text
        ],
        "expected_result":      el.findtext("expected_result", "").strip(),
        "test_type":            el.findtext("test_type", "functional").strip(),
    }

def _parse_architecture(el: ET.Element) -> dict:
    return {
        "component_name":       el.findtext("component_name", "").strip(),
        "description":          el.findtext("description", "").strip(),
        "technology_suggestion": el.findtext("technology_suggestion"),
        "interfaces":           [
            i.text.strip() for i in el.findall("interfaces/interface") if i.text
        ],
        "data_entities":        [
            d.text.strip() for d in el.findall("data_entities/entity") if d.text
        ],
    }

def _parse_risk(el: ET.Element) -> dict:
    return {
        "risk_id":     el.findtext("risk_id", "").strip(),
        "description": el.findtext("description", "").strip(),
        "likelihood":  el.findtext("likelihood", "medium").strip(),
        "impact":      el.findtext("impact", "medium").strip(),
        "mitigation":  el.findtext("mitigation", "").strip(),
        "owner":       el.findtext("owner"),
    }


# ── Render functions ───────────────────────────────────────────────────────────

def _render_functional_req_md(a: dict) -> str:
    md = f"## {a.get('req_id', '')} — {a.get('title', '')}\n\n"
    md += f"{a.get('description', '')}\n\n"
    if a.get("user_story"):
        md += f"**User Story:** {a['user_story']}\n\n"
    if a.get("acceptance_criteria"):
        md += "**Acceptance Criteria:**\n"
        for c in a["acceptance_criteria"]:
            md += f"- [ ] {c}\n"
    md += f"\n**Priority:** {a.get('priority', 'medium')}\n"
    return md

def _render_nfr_md(a: dict) -> str:
    md = f"## {a.get('req_id', '')} — {a.get('title', '')}\n\n"
    md += f"**Category:** {a.get('category', '')}\n\n"
    md += f"{a.get('description', '')}\n\n"
    if a.get("measurable_criteria"):
        md += f"**Measurable Criteria:** {a['measurable_criteria']}\n"
    md += f"\n**Priority:** {a.get('priority', 'medium')}\n"
    return md

def _render_task_md(a: dict) -> str:
    md = f"## {a.get('task_id', '')} — {a.get('title', '')}\n\n"
    md += f"**Type:** {a.get('task_type', 'task')}\n\n"
    md += f"{a.get('description', '')}\n\n"
    if a.get("estimated_hours"):
        md += f"**Estimate:** {a['estimated_hours']}h\n"
    if a.get("acceptance_criteria"):
        md += "\n**Acceptance Criteria:**\n"
        for c in a["acceptance_criteria"]:
            md += f"- [ ] {c}\n"
    if a.get("linked_requirement_id"):
        md += f"\n**Linked Requirement:** {a['linked_requirement_id']}\n"
    return md

def _render_test_case_md(a: dict) -> str:
    md = f"## {a.get('test_id', '')} — {a.get('title', '')}\n\n"
    md += f"**Tests:** {a.get('linked_requirement_id', '')}\n\n"
    if a.get("preconditions"):
        md += "**Preconditions:**\n"
        for p in a["preconditions"]:
            md += f"- {p}\n"
    md += "\n**Steps:**\n"
    for i, s in enumerate(a.get("steps", []), 1):
        md += f"{i}. {s}\n"
    md += f"\n**Expected Result:** {a.get('expected_result', '')}\n"
    return md

def _render_architecture_md(a: dict) -> str:
    md = f"## {a.get('component_name', '')}\n\n"
    md += f"{a.get('description', '')}\n\n"
    if a.get("technology_suggestion"):
        md += f"**Technology:** {a['technology_suggestion']}\n\n"
    if a.get("interfaces"):
        md += "**Interfaces:** " + ", ".join(a["interfaces"]) + "\n\n"
    if a.get("data_entities"):
        md += "**Data Entities:** " + ", ".join(a["data_entities"]) + "\n"
    return md

def _render_risk_md(a: dict) -> str:
    md = f"## {a.get('risk_id', '')} — Risk\n\n"
    md += f"{a.get('description', '')}\n\n"
    md += f"**Likelihood:** {a.get('likelihood', '')} | **Impact:** {a.get('impact', '')}\n\n"
    md += f"**Mitigation:** {a.get('mitigation', '')}\n"
    if a.get("owner"):
        md += f"\n**Owner:** {a['owner']}\n"
    return md


# ── Dispatch table ─────────────────────────────────────────────────────────────
# key = XML root tag that the refinement orchestrator validates against
# value = (child element tag, parse_fn, render_fn)

_DISPATCH: dict[str, tuple[str, callable, callable]] = {
    "functional_requirements":   ("requirement", _parse_functional_req, _render_functional_req_md),
    "nonfunctional_requirements": ("requirement", _parse_nfr,           _render_nfr_md),
    "tasks":                     ("task",         _parse_task,          _render_task_md),
    "test_cases":                ("test_case",    _parse_test_case,     _render_test_case_md),
    "architecture":              ("component",    _parse_architecture,  _render_architecture_md),
    "risks":                     ("risk",         _parse_risk,          _render_risk_md),
}


# ── Public API ─────────────────────────────────────────────────────────────────

def parse_single_artifact(raw_xml: str) -> dict | None:
    """
    Parse a single-artifact XML string (as returned by the refinement orchestrator)
    into the structured dict that the frontend card components expect.

    Returns None if the root tag is unrecognised (caller should fall back to raw storage).
    """
    root = ET.fromstring(raw_xml)
    entry = _DISPATCH.get(root.tag)
    if entry is None:
        return None
    child_tag, parse_fn, _ = entry
    children = root.findall(child_tag)
    if not children:
        return None
    return parse_fn(children[0])


def render_artifact_markdown(artifact_type: str, content_dict: dict) -> str:
    """
    Render a parsed artifact dict as human-readable markdown.
    Falls back to str(content_dict) for unknown types.
    """
    from app.services.refinementOrchestrator import ARTIFACT_ROOT_TAG_MAP
    root_tag = ARTIFACT_ROOT_TAG_MAP.get(artifact_type, "")
    entry = _DISPATCH.get(root_tag)
    if entry is None:
        return str(content_dict)
    _, _, render_fn = entry
    return render_fn(content_dict)
