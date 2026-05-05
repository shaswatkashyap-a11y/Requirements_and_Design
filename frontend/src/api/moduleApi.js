const BASE = 'http://localhost:8000/api'

export async function updateModule(runId, moduleId, { name, description }) {
  const res = await fetch(`${BASE}/generations/${runId}/modules/${moduleId}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, description }),
  })
  if (!res.ok) throw new Error('Failed to update module')
  return res.json()
}

export async function refineModule(runId, moduleId, feedback) {
  const res = await fetch(`${BASE}/generations/${runId}/modules/${moduleId}/refine`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ feedback }),
  })
  if (!res.ok) throw new Error('Failed to refine module')
  return res.json()
}

export async function regenerateModuleArtifacts(runId, moduleId) {
  const res = await fetch(`${BASE}/generations/${runId}/modules/${moduleId}/regenerate`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to regenerate artifacts')
  return res.json()
}

export async function fetchModuleVersions(runId, moduleId) {
  const res = await fetch(`${BASE}/generations/${runId}/modules/${moduleId}/versions`)
  if (!res.ok) throw new Error('Failed to fetch module versions')
  return res.json()
}
