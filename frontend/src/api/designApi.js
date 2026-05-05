const BASE = '/api'

export async function startHLDGeneration(projectId, { sowId, generationRunId } = {}) {
  const body = {}
  if (sowId)           body.sow_id            = sowId
  if (generationRunId) body.generation_run_id  = generationRunId

  const res = await fetch(`${BASE}/projects/${projectId}/design/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to start HLD generation')
  return res.json()
}

export async function fetchDesignRun(runId) {
  const res = await fetch(`${BASE}/design/${runId}`)
  if (!res.ok) throw new Error('Failed to fetch design run')
  return res.json()
}

export async function fetchProjectLatestDesign(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/design/latest`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch design run')
  return res.json()
}

export async function fetchProjectDesignHistory(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/design`)
  if (!res.ok) throw new Error('Failed to fetch design history')
  return res.json()
}

export async function fetchDesignArtifacts(runId) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts`)
  if (!res.ok) throw new Error('Failed to fetch design artifacts')
  return res.json()
}

export async function fetchDesignArtifact(runId, sectionType) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts/${sectionType}`)
  if (!res.ok) throw new Error(`Failed to fetch section: ${sectionType}`)
  return res.json()
}

export async function updateDesignArtifact(runId, sectionType, contentMarkdown) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts/${sectionType}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_markdown: contentMarkdown }),
  })
  if (!res.ok) throw new Error('Failed to save changes')
  return res.json()
}

export async function regenerateSection(runId, sectionType, instruction = null) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts/${sectionType}/regenerate`, {
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

export async function fetchSectionVersions(runId, sectionType) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts/${sectionType}/versions`)
  if (!res.ok) throw new Error('Failed to fetch versions')
  return res.json()
}

export async function restoreSectionVersion(runId, sectionType, versionId) {
  const res = await fetch(`${BASE}/design/${runId}/artifacts/${sectionType}/restore/${versionId}`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to restore version')
  return res.json()
}

export async function deleteDesignRun(runId) {
  const res = await fetch(`${BASE}/design/${runId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete design run')
  return true
}

export async function exportDesignRunDocx(runId, filename) {
  const res = await fetch(`${BASE}/design/${runId}/export/docx`)
  if (!res.ok) throw new Error('Failed to export HLD')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `HLD_run_${runId}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
