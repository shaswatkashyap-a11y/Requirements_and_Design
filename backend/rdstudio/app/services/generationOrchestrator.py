import re
import logging
import asyncio
import xml.etree.ElementTree as ET
from app.services.moduleRepository import ModuleRepository
from app.models.moduleVersion import ModuleVersionSource
from app.services.artifactRepository import ArtifactRepository
from app.services.generationRepository import GenerationRepository
from app.services.llmClient import LLMClient,ParseError
from app.services.promptBuilder import PromptBuilder
from app.services.responseParser import ResponseParser
from app.config.artifact_dependencies import resolve_generation_order

logger=logging.getLogger(__name__)

class GenerationOrchestrator:
    """Runs the full generation pipeline:
      1. Extract modules from classified SOW sections
      2. Generate artifacts in dependency order (parallel within each round)
      3. Save everything to DB with traceability"""
    
    def __init__(self, repo: ArtifactRepository, gen_repo: GenerationRepository) -> None:
        self.repo=repo
        self.gen_repo = gen_repo
        self.llm=LLMClient()
        self.parser=ResponseParser()
        
    async def run(self,generation_run_id:int):
        """Main entry point. Called from Celery task."""
    
        try:
            run=self.gen_repo.get_generation_run(generation_run_id)
            self.prompt_builder = PromptBuilder(db=self.repo.db, project_id=run.project_id)
            sow_id=run.sow_id
            methodology=run.methodology
            service_line_codes=run.service_line_codes
            requested_types=run.artifact_types_requested

            sections=self.repo.get_sow_sections(sow_id)

            # ── STEP 1: Extract modules ──
            self.gen_repo.update_status(generation_run_id,"extracting_modules","Analyzing SOW and identifying functional modules...")
            
            modules_data=await self._extract_modules(sections,methodology,service_line_codes) 


            db_modules=self.repo.save_modules(generation_run_id,modules_data)

            module_repo = ModuleRepository(self.repo.db)
            for db_module, module_data in zip(db_modules, modules_data):
                module_repo.append_version(
                    module_id   = db_module.id,
                    name        = module_data["name"],
                    description = module_data.get("description", ""),
                    source      = ModuleVersionSource.GENERATED,
                )

            # ── STEP 2+: Generate artifacts in dependency rounds ──
            rounds= resolve_generation_order(requested_types)
            all_artifacts_by_module={m.id : {} for m in db_modules}

            for round_idx,round_types in enumerate(rounds):
                self.gen_repo.update_status(
                    generation_run_id,"generating_artifacts",
                    f"Round {round_idx + 1}/{len(rounds)} : {','.join(round_types)}",
                    current_round=round_idx+1, total_rounds=len(rounds) 
                )
                
                # fire all (module × artifact_type) in this round concurrently
                tasks = [] # holds the actual LLM calls,
                task_keys= [] # tracks which module and artifact type each call is for. They stay in sync by index.



                for db_module,module_data in zip(db_modules,modules_data):
                    relevant_sections=self._get_relevant_sections(module_data,sections)

                    for art_type in round_types:
                        prereqs=all_artifacts_by_module[db_module.id]

                        tasks.append(
                            self._generate_single_artifact(
                                artifact_type=art_type,
                                module=module_data,
                                relevant_sections=relevant_sections,
                                methodology=methodology,
                                service_line_codes=service_line_codes,
                                prerequisite_artifacts=prereqs
                            )
                        )
                        task_keys.append((db_module.id,art_type))

                results=await asyncio.gather(*tasks,return_exceptions=True)

                for (module_id,art_type), result in zip(task_keys,results):
                    if isinstance(result, Exception):
                        logger.error(f"Failed: module={module_id}, type={art_type}: {result}")
                        continue

                    all_artifacts_by_module[module_id][art_type]=result

                    db_artifacts=self._convert_to_db_format(result,art_type,methodology)
                    
                    self.repo.save_artifacts(module_id,db_artifacts)

            self.gen_repo.update_status(generation_run_id, "completed")
            logger.info(f"Pipeline completed for run {generation_run_id}")

        except Exception as e:
            logger.exception(f"Pipeline failed for run {generation_run_id}")
            self.gen_repo.set_failed(generation_run_id, str(e))
            raise



    # ── Module Extraction ──

    async def _extract_modules(
            self,sections:list[dict],methodology:str,service_line_codes:list[str]
    ):
        
        # only send sections relevant to module extraction
        RELEVANT_TYPES = [
            "executive_summary",
            "scope",
            "objectives",
            "deliverables",
            "requirements",
            "technical_approach",
            "timeline",
            "roles_responsibilities",
            "assumptions_constraints",
            "acceptance_criteria",
        ]

        EXCLUDED_TYPES = [
            "budget_pricing",
            "terms_conditions",
            "communication",
            "appendix",
            "change_management",
        ]

        relevant_sections=[s for s in sections if  s["section_type"]  not in EXCLUDED_TYPES]

        # fallback — if filtering leaves too little, use everything
        if len(relevant_sections)<3:
            relevant_sections=sections



        formatted,label_map=self._format_sections_for_prompt(relevant_sections)

        system_prompt,user_prompt=self.prompt_builder.build(
            artifact_type="module_extraction",
            methodology=methodology,
            service_line_codes=service_line_codes,
            template_vars={"sow_sections":formatted}
        )

        # --- DEBUG: uncomment to inspect what the LLM actually sees ---
        # logger.debug(f"MODULE EXTRACTION PROMPT:\n{system_prompt}\n---\n{user_prompt}")


        raw=await self.llm.generate(system_prompt,user_prompt)

        # add this temporarily in _extract_modules before the parser call
        # print(f"\n--- Raw LLM output ---\n{raw}\n----------------------")

        logger.debug(f"Raw LLM output:\n{raw[:1000]}")


        root=self.parser.extract_xml(raw,["modules", "FunctionalModules", "Modules", "functional_modules"])

        modules=[]
        for mod_el in root:
            name = mod_el.findtext("name") or mod_el.findtext("Name") or ""
            description = mod_el.findtext("description") or mod_el.findtext("Description") or ""

             # --- Parse source IDs (new format: "S1, S3, S5") ---
            source_raw = (
                mod_el.findtext("source_ids")
                or mod_el.findtext("SourceIds")
                or mod_el.findtext("source_sections")  # fallback for old tag name
                or ""
            )

            source_section_ids = []
            for token in source_raw.split(","):
                label = token.strip().upper()  # normalize: "s1" -> "S1"
                if label in label_map:
                    section = label_map[label]
                    source_section_ids.append(section["id"])
                else:
                    logger.warning(
                        f"Module '{name.strip()}' referenced unknown label '{label}'"
                    )


            modules.append({
                "name": name.strip(),
                "description": description.strip(),
                "source_section_ids": source_section_ids
            })

        if not modules:
            raise ParseError("LLM returned zero modules")
        
        logger.info(f"Extracted {len(modules)} modules")
        return modules


    # ── Single Artifact Generation ──
    async def _generate_single_artifact(
            self,artifact_type:str,module:dict,
            relevant_sections:list[dict],methodology:str,
            service_line_codes:list[str],prerequisite_artifacts:dict, 
    ):
        module_prefix=module["name"][:3].upper().replace(" ","")
        formatted_sections,_=self._format_sections_for_prompt(relevant_sections)

        template_vars={
            "module_name":module["name"],
            "module_description":module.get("description",""),
            "module_prefix": module_prefix,
            "relevant_sections":formatted_sections
        }

        #inject prerequisite artifacts as context for downstream types
        if "functional_req" in prerequisite_artifacts:
            template_vars["functional_requirements"] = self._format_prereqs(
                prerequisite_artifacts["functional_req"]
            )
        if "nonfunctional_req" in prerequisite_artifacts:
            template_vars["nonfunctional_requirements"] = self._format_prereqs(
                prerequisite_artifacts["nonfunctional_req"]
            )

        # add after the existing prereq injection block
        if "functional_requirements" not in template_vars:
            template_vars["functional_requirements"] = "No functional requirements available."
        if "nonfunctional_requirements" not in template_vars:
            template_vars["nonfunctional_requirements"] = "No non-functional requirements available."

        system_prompt,user_prompt = self.prompt_builder.build(artifact_type,methodology,service_line_codes,template_vars)

        raw=await self.llm.generate(system_prompt,user_prompt)

        parsed_data=self._parse_artifact_response(raw,artifact_type)

        return parsed_data







    # ── Parsing Helpers ──
    def _parse_artifact_response(self,raw:str,artifact_type:str):
        """Route to the correct parser based on artifact type."""

        # "functional_req": ("functional_requirements", "requirement", self._parse_functional_req)
        #                               ↑                    ↑                    ↑
        #                        root XML tag         child element tag       parser function

        parser_map = {
            "functional_req": ("functional_requirements", "requirement", self._parse_functional_req),
            "nonfunctional_req": ("nonfunctional_requirements", "requirement", self._parse_nfr),
            "task": ("task_breakdown", "task", self._parse_task),
            "test_case": ("test_cases", "test_case", self._parse_test_case),
            "architecture": ("architecture", "component", self._parse_architecture_component),
            "risk_entry": ("risk_register", "risk", self._parse_risk),
        }

        if artifact_type not in parser_map:
            logger.warning(f"No parser for: {artifact_type}")
            return []
        
        root_tag,item_tag,parse_fn = parser_map[artifact_type]
        root = self.parser.extract_xml(raw,root_tag)

        return [parse_fn(el) for el in root.findall(item_tag)]

    def _parse_functional_req(self, el:ET.Element):
        return {
            "req_id": el.findtext("req_id", "").strip(),
            "title": el.findtext("title", "").strip(),
            "description": el.findtext("description", "").strip(),
            "user_story": el.findtext("user_story"),
            "acceptance_criteria": [
                c.text.strip() for c in el.findall("acceptance_criteria/criterion") if c.text
            ],
            "priority": el.findtext("priority", "medium").strip(),
            "source_section": el.findtext("source_section"),
        }

    def _parse_nfr(self, el: ET.Element) -> dict:
        return {
            "req_id": el.findtext("req_id", "").strip(),
            "category": el.findtext("category", "").strip(),
            "title": el.findtext("title", "").strip(),
            "description": el.findtext("description", "").strip(),
            "measurable_criteria": el.findtext("measurable_criteria"),
            "priority": el.findtext("priority", "medium").strip(),
        }

    def _parse_task(self, el: ET.Element) -> dict:
        return {
            "task_id": el.findtext("task_id", "").strip(),
            "title": el.findtext("title", "").strip(),
            "description": el.findtext("description", "").strip(),
            "task_type": el.findtext("task_type", "task").strip(),
            "parent_task_id": el.findtext("parent_task_id"),
            "estimated_hours": (
                float(el.findtext("estimated_hours", "0") or "0") or None
            ),
            "acceptance_criteria": [
                c.text.strip() for c in el.findall("acceptance_criteria/criterion") if c.text
            ],
            "linked_requirement_id": el.findtext("linked_requirement_id"),
        }

    def _parse_test_case(self, el: ET.Element) -> dict:
        return {
            "test_id": el.findtext("test_id", "").strip(),
            "title": el.findtext("title", "").strip(),
            "linked_requirement_id": el.findtext("linked_requirement_id", "").strip(),
            "preconditions": [
                p.text.strip() for p in el.findall("preconditions/precondition") if p.text
            ],
            "steps": [
                s.text.strip() for s in el.findall("steps/step") if s.text
            ],
            "expected_result": el.findtext("expected_result", "").strip(),
            "test_type": el.findtext("test_type", "functional").strip(),
        }

    def _parse_architecture_component(self, el: ET.Element) -> dict:
        return {
            "component_name": el.findtext("component_name", "").strip(),
            "description": el.findtext("description", "").strip(),
            "technology_suggestion": el.findtext("technology_suggestion"),
            "interfaces": [
                i.text.strip() for i in el.findall("interfaces/interface") if i.text
            ],
            "data_entities": [
                d.text.strip() for d in el.findall("data_entities/entity") if d.text
            ],
        }

    def _parse_risk(self, el: ET.Element) -> dict:
        return {
            "risk_id": el.findtext("risk_id", "").strip(),
            "description": el.findtext("description", "").strip(),
            "likelihood": el.findtext("likelihood", "medium").strip(),
            "impact": el.findtext("impact", "medium").strip(),
            "mitigation": el.findtext("mitigation", "").strip(),
            "owner": el.findtext("owner"),
        }







    # ── Formatting Helpers ──
    def _get_relevant_sections(self,module_data:dict,all_sections:list[dict]):
        """Get sections relevant to a module for artifact generation.
        
        Includes:
        1. Sections the module was extracted from (by ID)
        2. Any requirements/scope/deliverables sections as general context
        """
        
        source_ids = set(module_data.get("source_section_ids", []))
        relevant=[]
        seen_ids=set()

        for s in all_sections:
            # primary: sections this module was extracted from
            if s["id"] in source_ids:
                relevant.append(s)
                seen_ids.add(s["id"])
        
        for s in all_sections:
            # secondary: general context sections (avoid duplicates)
            if s["id"] not in seen_ids and s["section_type"] in (
                "requirements", "scope", "deliverables", "objectives"
            ):
                relevant.append(s)
                seen_ids.add(s["id"])

        return relevant

            
    def _format_sections_for_prompt(self,sections:list[dict]):
        """Format sections with short labels (S1, S2, ...) for LLM reference.
        Returns (formatted_string, label_to_section_map)."""
        parts = []
        label_map={}

        for i,s in enumerate(sections,1):
            label=f"S{i}"
            label_map[label]=s
            parts.append(
                f"[{label}] {s['title']} [{s.get('section_type', 'unknown')}]\n"
                f"{s['content'][:500]}\n"  # cap content length per section
            )
        return "\n".join(parts), label_map

        
    def _format_prereqs(self,artifacts:list[dict]):
        parts=[]
        for a in artifacts:
            aid = a.get("req_id", a.get("task_id", a.get("test_id", "")))
            parts.append(f"- [{aid}] {a.get('title', '')}")
        return "\n".join(parts)
    

    def _convert_to_db_format(self,artifacts:list[dict],artifact_type:str,methodology:str):
        db_artifacts=[]
        for a in artifacts:
            title = a.get(
                        "title",
                        a.get("req_id",
                        a.get("component_name",
                        a.get("risk_id",
                        a.get("test_id",
                        a.get("task_id", "Untitled"))))))
            
            db_artifacts.append({
                "artifact_type": artifact_type,
                "title": title,
                "content_json": a,
                "content_markdown": self._render_markdown(a, artifact_type),
                "methodology_format": methodology,
                "source_section_ids":None
            })
        return db_artifacts

    def _render_markdown(self, artifact: dict, artifact_type: str) -> str:
        """Render artifact as human-readable markdown."""
        renderers = {
            "functional_req": self._render_functional_req_md,
            "nonfunctional_req": self._render_nfr_md,
            "task": self._render_task_md,
            "test_case": self._render_test_case_md,
            "architecture": self._render_architecture_md,
            "risk_entry": self._render_risk_md,
        }
        renderer = renderers.get(artifact_type)
        if renderer:
            return renderer(artifact)
        return str(artifact)

    def _render_functional_req_md(self, a: dict) -> str:
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

    def _render_nfr_md(self, a: dict) -> str:
        md = f"## {a.get('req_id', '')} — {a.get('title', '')}\n\n"
        md += f"**Category:** {a.get('category', '')}\n\n"
        md += f"{a.get('description', '')}\n\n"
        if a.get("measurable_criteria"):
            md += f"**Measurable Criteria:** {a['measurable_criteria']}\n"
        md += f"\n**Priority:** {a.get('priority', 'medium')}\n"
        return md

    def _render_task_md(self, a: dict) -> str:
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

    def _render_test_case_md(self, a: dict) -> str:
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

    def _render_architecture_md(self, a: dict) -> str:
        md = f"## {a.get('component_name', '')}\n\n"
        md += f"{a.get('description', '')}\n\n"
        if a.get("technology_suggestion"):
            md += f"**Technology:** {a['technology_suggestion']}\n\n"
        if a.get("interfaces"):
            md += "**Interfaces:** " + ", ".join(a["interfaces"]) + "\n\n"
        if a.get("data_entities"):
            md += "**Data Entities:** " + ", ".join(a["data_entities"]) + "\n"
        return md

    def _render_risk_md(self, a: dict) -> str:
        md = f"## {a.get('risk_id', '')} — Risk\n\n"
        md += f"{a.get('description', '')}\n\n"
        md += f"**Likelihood:** {a.get('likelihood', '')} | **Impact:** {a.get('impact', '')}\n\n"
        md += f"**Mitigation:** {a.get('mitigation', '')}\n"
        if a.get("owner"):
            md += f"\n**Owner:** {a['owner']}\n"
        return md





















































