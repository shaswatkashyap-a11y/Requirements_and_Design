import base64
import logging
import httpx
from sqlalchemy.orm import Session

from app.models.module import Module
from app.models.artifact import Artifact

logger = logging.getLogger(__name__)

PRIORITY_MAP = {"high": "High", "medium": "Medium", "low": "Low"}


def _adf(text: str) -> dict:
    """Atlassian Document Format — plain paragraph."""
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text or "—"}],
            }
        ],
    }


def _adf_rich(parts: list[str]) -> dict:
    """Multiple paragraphs."""
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": p}],
            }
            for p in parts if p
        ],
    }


class JiraService:
    def __init__(self, jira_url: str, email: str, api_token: str, project_key: str):
        url = jira_url.strip().rstrip("/")
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
        self.base     = url
        self.proj_key = project_key.upper().strip()
        creds         = base64.b64encode(f"{email}:{api_token}".encode()).decode()
        self.headers  = {
            "Authorization": f"Basic {creds}",
            "Content-Type":  "application/json",
            "Accept":        "application/json",
        }
        # Cached once we discover which linking style this project uses.
        # None = unknown, "parent" = next-gen, "epic_link" = classic
        self._link_style: str | None = None

    # ── Connection test ───────────────────────────────────────────────────────

    def verify_connection(self) -> dict:
        """Returns project metadata or raises httpx.HTTPStatusError."""
        with httpx.Client(timeout=10) as c:
            r = c.get(
                f"{self.base}/rest/api/3/project/{self.proj_key}",
                headers=self.headers,
            )
            r.raise_for_status()
            data = r.json()
            # Cache project style while we're here
            style = data.get("style", "")
            self._link_style = "parent" if style == "next-gen" else None
            return {"name": data.get("name"), "key": data.get("key")}

    # ── Issue creators ────────────────────────────────────────────────────────

    def _create_issue(self, payload: dict) -> str:
        """POST to Jira, returns issue key like 'RND-1'."""
        with httpx.Client(timeout=20) as c:
            r = c.post(
                f"{self.base}/rest/api/3/issue",
                headers=self.headers,
                json=payload,
            )
            if not r.is_success:
                logger.error(f"Jira error {r.status_code}: {r.text}")
                r.raise_for_status()
            return r.json()["key"]

    def _create_issue_linked(self, payload: dict, epic_key: str) -> str:
        """
        Create an issue linked to an Epic.

        Team-managed (next-gen) projects use the `parent` field.
        Company-managed (classic) projects use `customfield_10014` (Epic Link).

        We try `parent` first; if Jira rejects it with a hierarchy error we
        fall back to `customfield_10014` and remember the style for future calls.
        """
        if self._link_style == "epic_link":
            # Already know this project needs Epic Link
            return self._try_epic_link(payload, epic_key)

        # Attempt 1: parent field (works for next-gen / team-managed)
        payload_v1 = {**payload, "fields": {**payload["fields"], "parent": {"key": epic_key}}}
        with httpx.Client(timeout=20) as c:
            r = c.post(f"{self.base}/rest/api/3/issue", headers=self.headers, json=payload_v1)
            if r.is_success:
                self._link_style = "parent"
                return r.json()["key"]

            err_body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            errors   = err_body.get("errors", {})
            is_hierarchy_err = (
                r.status_code == 400
                and ("hierarchy" in r.text.lower() or "parentId" in errors or "parentid" in r.text.lower())
            )

            if not is_hierarchy_err:
                logger.error(f"Jira error {r.status_code}: {r.text}")
                r.raise_for_status()

        # Attempt 2: Epic Link custom field (classic / company-managed)
        logger.info(f"parent field rejected — retrying with customfield_10014 (Epic Link) for {epic_key}")
        self._link_style = "epic_link"
        return self._try_epic_link(payload, epic_key)

    def _try_epic_link(self, payload: dict, epic_key: str) -> str:
        """Create issue using the classic Epic Link custom field."""
        fields = {k: v for k, v in payload["fields"].items() if k != "parent"}
        fields["customfield_10014"] = epic_key
        return self._create_issue({**payload, "fields": fields})

    def create_epic(self, module: Module) -> str:
        payload = {
            "fields": {
                "project":     {"key": self.proj_key},
                "summary":     module.name,
                "description": _adf(module.description or ""),
                "issuetype":   {"name": "Epic"},
            }
        }
        return self._create_issue(payload)

    def create_story_from_fr(self, artifact: Artifact, epic_key: str) -> str:
        d    = artifact.content_json or {}
        acs  = d.get("acceptance_criteria") or []
        parts = []
        if d.get("description"):
            parts.append(d["description"])
        if d.get("user_story"):
            parts.append(f"User Story: {d['user_story']}")
        if acs:
            parts.append("Acceptance Criteria: " + " | ".join(acs[:5]))

        payload = {
            "fields": {
                "project":   {"key": self.proj_key},
                "summary":   f"[{d.get('req_id', '')}] {d.get('title', artifact.title)}",
                "description": _adf_rich(parts),
                "issuetype": {"name": "Story"},
                "priority":  {"name": PRIORITY_MAP.get(d.get("priority", "medium"), "Medium")},
            }
        }
        return self._create_issue_linked(payload, epic_key)

    def create_story_from_nfr(self, artifact: Artifact, epic_key: str) -> str:
        d     = artifact.content_json or {}
        parts = []
        if d.get("description"):
            parts.append(d["description"])
        if d.get("measurable_criteria"):
            parts.append(f"Measurable: {d['measurable_criteria']}")

        payload = {
            "fields": {
                "project":     {"key": self.proj_key},
                "summary":     f"[{d.get('req_id', '')}] {d.get('title', artifact.title)}",
                "description": _adf_rich(parts),
                "issuetype":   {"name": "Story"},
                "priority":    {"name": PRIORITY_MAP.get(d.get("priority", "medium"), "Medium")},
            }
        }
        return self._create_issue_linked(payload, epic_key)

    def create_task(self, artifact: Artifact, epic_key: str,
                    linked_story_key: str | None = None) -> str:
        d    = artifact.content_json or {}
        desc = d.get("description", "")
        if d.get("estimated_hours"):
            desc += f"\n\nEstimated: {d['estimated_hours']} hours"
        if linked_story_key:
            desc += f"\n\nLinked Story: {linked_story_key}"

        payload = {
            "fields": {
                "project":     {"key": self.proj_key},
                "summary":     f"[{d.get('task_id', '')}] {d.get('title', artifact.title)}",
                "description": _adf(desc),
                "issuetype":   {"name": "Task"},
            }
        }
        return self._create_issue_linked(payload, epic_key)

    # ── Module push orchestrator ──────────────────────────────────────────────

    def push_module(
        self,
        module: Module,
        db: Session,
        push_nfrs:  bool = True,
        push_tasks: bool = True,
        nfr_epic_key: str | None = None,
    ) -> dict:
        """
        Push one module to Jira:
          Module         → Epic
          functional_req → Story  (linked to Epic)
          task           → Task   (linked to Epic)
          nonfunctional_req → Story (linked to nfr_epic_key if provided, else own Epic)

        Saves jira keys back to DB. Returns summary dict.
        """
        result = {"epic_key": None, "stories": [], "tasks": [], "nfr_stories": [], "errors": [], "skipped": []}

        # 1. Create Epic (or reuse existing if already pushed)
        if module.jira_epic_key:
            epic_key = module.jira_epic_key
            result["epic_key"] = epic_key
            logger.info(f"Module {module.name} already has Epic {epic_key} — reusing, pushing only new artifacts")
        else:
            try:
                epic_key = self.create_epic(module)
                module.jira_epic_key = epic_key
                db.commit()
                result["epic_key"] = epic_key
            except Exception as e:
                result["errors"].append(f"Epic creation failed: {e}")
                return result

        # 2. req_id → story key map (for task linking)
        fr_key_map: dict[str, str] = {}

        # 3. Functional requirements → Stories
        frs = sorted(
            [a for a in module.artifacts if a.artifact_type == "functional_req"],
            key=lambda a: a.sort_order,
        )
        for fr in frs:
            if fr.jira_issue_key:
                result["skipped"].append(fr.jira_issue_key)
                req_id = (fr.content_json or {}).get("req_id", "")
                if req_id:
                    fr_key_map[req_id] = fr.jira_issue_key
                continue
            try:
                story_key = self.create_story_from_fr(fr, epic_key)
                fr.jira_issue_key = story_key
                db.commit()
                req_id = (fr.content_json or {}).get("req_id", "")
                if req_id:
                    fr_key_map[req_id] = story_key
                result["stories"].append(story_key)
            except Exception as e:
                result["errors"].append(f"Story {fr.title}: {e}")

        # 4. Tasks → Tasks (linked to Epic, story reference in description)
        if push_tasks:
            tasks = sorted(
                [a for a in module.artifacts if a.artifact_type == "task"],
                key=lambda a: a.sort_order,
            )
            for task in tasks:
                if task.jira_issue_key:
                    result["skipped"].append(task.jira_issue_key)
                    continue
                try:
                    linked = (task.content_json or {}).get("linked_requirement_id", "")
                    story_ref = fr_key_map.get(linked)
                    task_key = self.create_task(task, epic_key, linked_story_key=story_ref)
                    task.jira_issue_key = task_key
                    db.commit()
                    result["tasks"].append(task_key)
                except Exception as e:
                    result["errors"].append(f"Task {task.title}: {e}")

        # 5. NFRs → Stories (under shared NFR Epic or own Epic)
        if push_nfrs:
            nfrs = sorted(
                [a for a in module.artifacts if a.artifact_type == "nonfunctional_req"],
                key=lambda a: a.sort_order,
            )
            target_epic = nfr_epic_key or epic_key
            for nfr in nfrs:
                if nfr.jira_issue_key:
                    result["skipped"].append(nfr.jira_issue_key)
                    continue
                try:
                    nfr_key = self.create_story_from_nfr(nfr, target_epic)
                    nfr.jira_issue_key = nfr_key
                    db.commit()
                    result["nfr_stories"].append(nfr_key)
                except Exception as e:
                    result["errors"].append(f"NFR {nfr.title}: {e}")

        return result


def jira_service_from_project(project) -> "JiraService":
    """Build JiraService from project ORM object. Raises ValueError if not configured."""
    if not all([project.jira_url, project.jira_project_key,
                project.jira_user_email, project.jira_api_token]):
        raise ValueError("Jira is not configured for this project. Add Jira config in project settings.")
    return JiraService(
        jira_url    = project.jira_url,
        email       = project.jira_user_email,
        api_token   = project.jira_api_token,
        project_key = project.jira_project_key,
    )
