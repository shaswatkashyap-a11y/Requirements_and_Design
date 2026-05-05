const BASE = 'http://localhost:8000/api'

export async function fetchPrompts(projectId = null) {
  const url = projectId
    ? `${BASE}/prompts?project_id=${projectId}`
    : `${BASE}/prompts`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch prompts')
  return res.json()
}

export async function fetchPrompt(id) {
  const res = await fetch(`${BASE}/prompts/${id}`)
  if (!res.ok) throw new Error('Failed to fetch prompt')
  return res.json()
}

// Direct content update — used for project-specific rows or global rows on admin page
export async function updatePrompt(id, content) {
  const res = await fetch(`${BASE}/prompts/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ content }),
  })
  if (!res.ok) throw new Error('Failed to update prompt')
  return res.json()
}

// Save edited content as a project-specific version (inactive by default)
// Called when user edits a global prompt and clicks Save in project context
export async function saveProjectVersion(globalPromptId, projectId, content) {
  const res = await fetch(`${BASE}/prompts/${globalPromptId}/save-version`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ project_id: projectId, content }),
  })
  if (!res.ok) throw new Error('Failed to save project version')
  return res.json()
}

// Override on a project-specific row: activate it for the project
export async function activatePrompt(id) {
  const res = await fetch(`${BASE}/prompts/${id}/activate`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to activate prompt')
  return res.json()
}

// Override on a global row: deactivate project-specific row (revert to global)
export async function deactivateProjectOverride(globalPromptId, projectId) {
  const res = await fetch(`${BASE}/prompts/${globalPromptId}/deactivate-override`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ project_id: projectId }),
  })
  if (!res.ok) throw new Error('Failed to deactivate override')
}

export async function previewPrompt({ artifactType, methodology, serviceLineCodes, sampleContentJson, sampleFeedback }) {
  const res = await fetch(`${BASE}/prompts/preview`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      artifact_type:       artifactType,
      methodology:         methodology,
      service_line_codes:  serviceLineCodes || [],
      sample_content_json: sampleContentJson || null,
      sample_feedback:     sampleFeedback || 'Improve this artifact',
    }),
  })
  if (!res.ok) throw new Error('Failed to preview prompt')
  return res.json()
}
