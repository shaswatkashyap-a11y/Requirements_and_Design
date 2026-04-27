const BASE = 'http://localhost:8000/api'

// ── Config ────────────────────────────────────────────────────────────────────

export async function fetchMethodologies() {
  const res = await fetch(`${BASE}/config/methodologies`)
  if (!res.ok) throw new Error('Failed to fetch methodologies')
  return res.json()
}

export async function fetchServiceLines() {
  const res = await fetch(`${BASE}/config/service-lines`)
  if (!res.ok) throw new Error('Failed to fetch service lines')
  return res.json()
}

export async function fetchArtifactTypes(methodology, serviceLineCodes) {
  const params = new URLSearchParams({ methodology })
  for (const code of serviceLineCodes) params.append('service_lines', code)
  const res = await fetch(`${BASE}/config/artifact-types?${params}`)
  if (!res.ok) throw new Error('Failed to fetch artifact types')
  return res.json()
}

// ── Generation ────────────────────────────────────────────────────────────────

export async function startGeneration(projectId, sowId, { methodology, service_line_codes, artifact_types = null }) {
  const res = await fetch(`${BASE}/projects/${projectId}/sows/${sowId}/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodology, service_line_codes, artifact_types }),
  })
  if (!res.ok) throw new Error('Failed to start generation')
  return res.json()
}

export async function fetchGenerationStatus(runId) {
  const res = await fetch(`${BASE}/generations/${runId}`)
  if (!res.ok) throw new Error('Failed to fetch generation status')
  return res.json()
}

export async function fetchProjectGenerations(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/generations`)
  if (!res.ok) throw new Error('Failed to fetch generation history')
  return res.json()
}

export async function fetchGenerationModules(runId) {
  const res = await fetch(`${BASE}/generations/${runId}/modules`)
  if (!res.ok) throw new Error('Failed to fetch generation modules')
  return res.json()
}

export async function cancelGenerationRun(runId) {
  const res = await fetch(`${BASE}/generations/${runId}/cancel`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to cancel generation run')
  return res.json()
}

export async function deleteGenerationRun(runId) {
  const res = await fetch(`${BASE}/generations/${runId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete generation run')
}

export async function fetchModuleArtifacts(runId, moduleId, artifactType) {
  const url = artifactType
    ? `${BASE}/generations/${runId}/modules/${moduleId}/artifacts?artifact_type=${artifactType}`
    : `${BASE}/generations/${runId}/modules/${moduleId}/artifacts`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch artifacts')
  return res.json()
}

export async function triggerValidation(runId) {
  const res = await fetch(`${BASE}/generations/${runId}/validate`, { method: 'POST' })
  if (!res.ok) throw new Error('Validation failed to run')
  return res.json()
}