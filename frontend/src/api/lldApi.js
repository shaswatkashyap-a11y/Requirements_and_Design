const BASE = '/api'

export async function startLLDGeneration(projectId, { sowId, designRunId, generationRunId } = {}) {
  const body = {}
  if (sowId)           body.sow_id            = sowId
  if (designRunId)     body.design_run_id     = designRunId
  if (generationRunId) body.generation_run_id = generationRunId

  const res = await fetch(`${BASE}/projects/${projectId}/lld/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to start LLD generation')
  return res.json()
}

export async function fetchLLDRun(runId) {
  const res = await fetch(`${BASE}/lld/${runId}`)
  if (!res.ok) throw new Error('Failed to fetch LLD run')
  return res.json()
}

export async function fetchProjectLatestLLD(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/lld/latest`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch LLD run')
  return res.json()
}

export async function fetchProjectLLDHistory(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/lld`)
  if (!res.ok) throw new Error('Failed to fetch LLD history')
  return res.json()
}

export async function fetchLLDArtifacts(runId) {
  const res = await fetch(`${BASE}/lld/${runId}/artifacts`)
  if (!res.ok) throw new Error('Failed to fetch LLD artifacts')
  return res.json()
}

export async function updateLLDArtifact(runId, sectionType, contentMarkdown) {
  const res = await fetch(`${BASE}/lld/${runId}/artifacts/${sectionType}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_markdown: contentMarkdown }),
  })
  if (!res.ok) throw new Error('Failed to save changes')
  return res.json()
}

export async function regenerateLLDSection(runId, sectionType, instruction = null) {
  const res = await fetch(`${BASE}/lld/${runId}/artifacts/${sectionType}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction: instruction || null }),
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try { const e = await res.json(); detail += `: ${e.detail || JSON.stringify(e)}` } catch {}
    throw new Error(detail)
  }
  return res.json()
}

export async function fetchLLDSectionVersions(runId, sectionType) {
  const res = await fetch(`${BASE}/lld/${runId}/artifacts/${sectionType}/versions`)
  if (!res.ok) throw new Error('Failed to fetch versions')
  return res.json()
}

export async function restoreLLDSectionVersion(runId, sectionType, versionId) {
  const res = await fetch(`${BASE}/lld/${runId}/artifacts/${sectionType}/restore/${versionId}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to restore version')
  return res.json()
}

export async function deleteLLDRun(runId) {
  const res = await fetch(`${BASE}/lld/${runId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete LLD run')
  return true
}
