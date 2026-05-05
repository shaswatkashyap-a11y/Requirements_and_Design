const _ALL = [
  'module_extraction',
  'functional_req',
  'nonfunctional_req',
  'task',
  'test_case',
  'architecture',
  'risk_entry',
]

export const PROMPT_SCHEMAS = {
  base: Object.fromEntries(
    _ALL.map((key) => [key, { root: 'prompt', required: ['system', 'user'] }])
  ),
  methodology: {
    agile:     { root: 'methodology', required: ['global_instructions', 'artifact_overrides'], overrides: _ALL },
    scrum:     { root: 'methodology', required: ['global_instructions', 'artifact_overrides'], overrides: _ALL },
    waterfall: { root: 'methodology', required: ['global_instructions', 'artifact_overrides'], overrides: _ALL },
  },
  service_line: {
    aws:                 { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: ['architecture', 'nonfunctional_req'] },
    react:               { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: ['architecture', 'task'] },
    agentic_ai:          { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    ai_ml:               { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    angular:             { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    azure:               { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    data_ai:             { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    dotnet:              { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    gcp:                 { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    java:                { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    netsuite:            { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    oracle_applications: { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    python_dev:          { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    salesforce:          { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    sap:                 { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
    servicenow:          { root: 'service_line', required: ['tech_context', 'artifact_overrides'], overrides: _ALL },
  },
}
