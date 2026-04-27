"""
Defines which artifact types depend on others.
The orchestrator uses this to determine generation order.
Artifacts in the same round run in parallel via asyncio.gather.
"""

from collections import deque

ARTIFACT_DEPENDENCIES = {
    # Round 1 — no dependencies, run immediately after module extraction
    "functional_req": [],
    "nonfunctional_req": [],
    "risk_entry": [],

    # Round 2 — depend on Round 1 outputs
    "epic": ["functional_req"],
    "user_story": ["functional_req"],
    "task": ["functional_req"],
    "test_case": ["functional_req"],
    "architecture": ["functional_req", "nonfunctional_req"],
    "component_design": ["functional_req", "nonfunctional_req"],
    "data_model": ["functional_req"],
    "traceability_matrix": ["functional_req", "nonfunctional_req"],
}

METHODOLOGY_ARTIFACT_MAP = {
    "scrum": [
        "functional_req",
        "nonfunctional_req", 
        "epic",
        "user_story",
        "task",
        "test_case",
        "architecture",
        "risk_entry",
    ],
    "waterfall": [
        "functional_req",
        "nonfunctional_req",
        "architecture",
        "component_design",
        "data_model",
        "test_case",
        "risk_entry",
        # no epics, no user_stories, no tasks
    ],
    "agile": [
        "functional_req",
        "nonfunctional_req",
        "epic",
        "user_story",
        "test_case",
        "risk_entry",
        # tasks optional
    ],
}

def resolve_generation_order(requested_types: list[str]) -> list[list[str]]:
    """
    Given requested artifact types, returns them grouped into
    sequential rounds. Types within the same round run in parallel.
    Automatically adds missing dependencies.

    Example output:
    [
        ["functional_req", "nonfunctional_req", "risk_entry"],   # round 1
        ["task", "test_case", "architecture"],                    # round 2
    ]
    """
    # ensure all dependencies are included
    all_needed = set(requested_types)
    queue = deque(requested_types)
    
    while queue:
        art_type=queue.popleft()
        for dep in ARTIFACT_DEPENDENCIES.get(art_type,[]):
            if dep not in all_needed:
                all_needed.add(dep)
                queue.append(dep)

    
    # group into rounds by dependency depth
    resolved = set()
    rounds = []

    while all_needed - resolved:
        current_round = []
        for art_type in all_needed - resolved:
            deps = ARTIFACT_DEPENDENCIES.get(art_type, [])
            if all(d in resolved for d in deps):
                current_round.append(art_type)

        if not current_round:
            raise ValueError(f"Circular dependency detected in: {all_needed - resolved}")

        rounds.append(sorted(current_round))
        resolved.update(current_round)

    return rounds