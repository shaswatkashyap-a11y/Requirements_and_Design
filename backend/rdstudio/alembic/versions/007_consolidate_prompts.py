"""007 - consolidate prompts

Data migration: merges per-section prompt rows (system/user, global_instructions,
tech_context) into single 'full' XML rows per artifact_type/scope_key.

Revision ID: 007
Revises: 006
"""
from typing import Union
from alembic import op
from sqlalchemy import text
import xml.etree.ElementTree as ET
from xml.etree.ElementTree import Element, SubElement

revision: str = '007'
down_revision: Union[str, None] = '006'
branch_labels = None
depends_on = None


def _to_xml(root: Element) -> str:
    return ET.tostring(root, encoding="unicode")


def _consolidate_base(bind) -> None:
    rows = bind.execute(text(
        "SELECT artifact_type, section, content, project_id, is_active "
        "FROM prompt_templates WHERE prompt_type='base' AND section IN ('system','user')"
    )).fetchall()

    groups: dict = {}
    for artifact_type, section, content, project_id, is_active in rows:
        key = (artifact_type, project_id)
        if key not in groups:
            groups[key] = {"sections": {}, "is_active": False}
        groups[key]["sections"][section] = content or ""
        if is_active:
            groups[key]["is_active"] = True

    for (artifact_type, project_id), data in groups.items():
        root = Element("prompt")
        SubElement(root, "system").text = data["sections"].get("system", "")
        SubElement(root, "user").text   = data["sections"].get("user", "")
        xml_content = _to_xml(root)
        active = 1 if data["is_active"] else 0

        if project_id is None:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('base', :at, NULL, 'full', :content, NULL, 1, NOW(), NOW())"
            ), {"at": artifact_type, "content": xml_content})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='base' AND artifact_type=:at "
                "AND section IN ('system','user') AND project_id IS NULL"
            ), {"at": artifact_type})
        else:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('base', :at, NULL, 'full', :content, :pid, :active, NOW(), NOW())"
            ), {"at": artifact_type, "content": xml_content, "pid": project_id, "active": active})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='base' AND artifact_type=:at "
                "AND section IN ('system','user') AND project_id=:pid"
            ), {"at": artifact_type, "pid": project_id})


def _consolidate_methodology(bind) -> None:
    rows = bind.execute(text(
        "SELECT artifact_type, scope_key, section, content, project_id, is_active "
        "FROM prompt_templates WHERE prompt_type='methodology' "
        "AND section IN ('global_instructions','artifact_override')"
    )).fetchall()

    groups: dict = {}
    for artifact_type, scope_key, section, content, project_id, is_active in rows:
        key = (scope_key, project_id)
        if key not in groups:
            groups[key] = {"global": "", "overrides": {}, "is_active": False}
        if section == "global_instructions":
            groups[key]["global"] = content or ""
        elif section == "artifact_override" and artifact_type:
            groups[key]["overrides"][artifact_type] = content or ""
        if is_active:
            groups[key]["is_active"] = True

    for (scope_key, project_id), data in groups.items():
        root = Element("methodology")
        SubElement(root, "global_instructions").text = data["global"]
        if data["overrides"]:
            ao = SubElement(root, "artifact_overrides")
            for at, content in data["overrides"].items():
                SubElement(ao, at).text = content
        xml_content = _to_xml(root)
        active = 1 if data["is_active"] else 0

        if project_id is None:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('methodology', NULL, :sk, 'full', :content, NULL, 1, NOW(), NOW())"
            ), {"sk": scope_key, "content": xml_content})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='methodology' AND scope_key=:sk "
                "AND section IN ('global_instructions','artifact_override') AND project_id IS NULL"
            ), {"sk": scope_key})
        else:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('methodology', NULL, :sk, 'full', :content, :pid, :active, NOW(), NOW())"
            ), {"sk": scope_key, "content": xml_content, "pid": project_id, "active": active})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='methodology' AND scope_key=:sk "
                "AND section IN ('global_instructions','artifact_override') AND project_id=:pid"
            ), {"sk": scope_key, "pid": project_id})


def _consolidate_service_line(bind) -> None:
    rows = bind.execute(text(
        "SELECT artifact_type, scope_key, section, content, project_id, is_active "
        "FROM prompt_templates WHERE prompt_type='service_line' "
        "AND section IN ('tech_context','artifact_override')"
    )).fetchall()

    groups: dict = {}
    for artifact_type, scope_key, section, content, project_id, is_active in rows:
        key = (scope_key, project_id)
        if key not in groups:
            groups[key] = {"tech_context": "", "overrides": {}, "is_active": False}
        if section == "tech_context":
            groups[key]["tech_context"] = content or ""
        elif section == "artifact_override" and artifact_type:
            groups[key]["overrides"][artifact_type] = content or ""
        if is_active:
            groups[key]["is_active"] = True

    for (scope_key, project_id), data in groups.items():
        root = Element("service_line")
        SubElement(root, "tech_context").text = data["tech_context"]
        if data["overrides"]:
            ao = SubElement(root, "artifact_overrides")
            for at, content in data["overrides"].items():
                SubElement(ao, at).text = content
        xml_content = _to_xml(root)
        active = 1 if data["is_active"] else 0

        if project_id is None:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('service_line', NULL, :sk, 'full', :content, NULL, 1, NOW(), NOW())"
            ), {"sk": scope_key, "content": xml_content})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='service_line' AND scope_key=:sk "
                "AND section IN ('tech_context','artifact_override') AND project_id IS NULL"
            ), {"sk": scope_key})
        else:
            bind.execute(text(
                "INSERT INTO prompt_templates (prompt_type, artifact_type, scope_key, section, content, project_id, is_active, created_at, updated_at) "
                "VALUES ('service_line', NULL, :sk, 'full', :content, :pid, :active, NOW(), NOW())"
            ), {"sk": scope_key, "content": xml_content, "pid": project_id, "active": active})
            bind.execute(text(
                "DELETE FROM prompt_templates WHERE prompt_type='service_line' AND scope_key=:sk "
                "AND section IN ('tech_context','artifact_override') AND project_id=:pid"
            ), {"sk": scope_key, "pid": project_id})


def upgrade() -> None:
    bind = op.get_bind()
    _consolidate_base(bind)
    _consolidate_methodology(bind)
    _consolidate_service_line(bind)


def downgrade() -> None:
    pass
