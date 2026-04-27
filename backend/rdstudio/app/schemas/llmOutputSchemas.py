from pydantic import BaseModel, Field


# --- Module extraction ---
class ExtractedModule(BaseModel):
    name: str
    description: str
    source_sections: list[str] = Field(
        description="Titles of SOW sections this module was derived from"
    )

class ModuleExtractionOutput(BaseModel):
    modules: list[ExtractedModule]


# --- Functional requirements ---
class FunctionalRequirement(BaseModel):
    req_id: str                            # "FR-UM-001"
    title: str
    description: str
    user_story: str | None = None          # "As a [role]..." — present for Scrum
    acceptance_criteria: list[str] = []
    priority: str = "medium"               # high, medium, low
    source_section: str | None = None      # traceability

class FunctionalReqOutput(BaseModel):
    module_name: str
    requirements: list[FunctionalRequirement]


# --- Non-functional requirements ---
class NonFunctionalRequirement(BaseModel):
    req_id: str
    category: str                          # performance, security, compliance, etc.
    title: str
    description: str
    measurable_criteria: str | None = None # "Response time < 200ms"
    priority: str = "medium"

class NonFunctionalReqOutput(BaseModel):
    module_name: str
    requirements: list[NonFunctionalRequirement]


# --- Task breakdown ---
class TaskItem(BaseModel):
    task_id: str
    title: str
    description: str
    task_type: str                         # epic, story, task, subtask
    parent_task_id: str | None = None      # story → epic, task → story
    estimated_hours: float | None = None
    acceptance_criteria: list[str] = []
    linked_requirement_id: str | None = None

class TaskBreakdownOutput(BaseModel):
    module_name: str
    tasks: list[TaskItem]


# --- Test cases ---
class TestCase(BaseModel):
    test_id: str
    title: str
    linked_requirement_id: str
    preconditions: list[str] = []
    steps: list[str]
    expected_result: str
    test_type: str = "functional"          # functional, integration, edge_case

class TestCaseOutput(BaseModel):
    module_name: str
    test_cases: list[TestCase]


# --- Architecture ---
class ArchitectureComponent(BaseModel):
    component_name: str
    description: str
    technology_suggestion: str | None = None
    interfaces: list[str] = []
    data_entities: list[str] = []

class ArchitectureOutput(BaseModel):
    module_name: str
    overview: str
    components: list[ArchitectureComponent]


# --- Risk register ---
class RiskEntry(BaseModel):
    risk_id: str
    description: str
    likelihood: str                        # high, medium, low
    impact: str                            # high, medium, low
    mitigation: str
    owner: str | None = None

class RiskRegisterOutput(BaseModel):
    module_name: str
    risks: list[RiskEntry]