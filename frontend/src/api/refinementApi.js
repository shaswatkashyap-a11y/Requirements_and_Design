const BASE = 'http://localhost:8000/api'

export async function refineArtifact(runId, artifactId, { feedback, cascadeStale = true }) {
  const res = await fetch(
    `${BASE}/generations/${runId}/artifacts/${artifactId}/refine`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ feedback, cascade_stale: cascadeStale }),
    }
  )
  if (res.status === 409) {
    throw new Error('Refinement already in progress. Please wait.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Refinement failed')
  }
  return res.json()
}

export async function manualEditArtifact(runId, artifactId, { contentMarkdown, contentJson }) {
  const res = await fetch(
    `${BASE}/generations/${runId}/artifacts/${artifactId}`,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        content_markdown: contentMarkdown,
        content_json:     contentJson,
      }),
    }
  )
  if (!res.ok) throw new Error('Failed to save edit')
  return res.json()
}

export async function fetchArtifactHistory(runId, artifactId) {
  const res = await fetch(
    `${BASE}/generations/${runId}/artifacts/${artifactId}/history`
  )
  if (!res.ok) throw new Error('Failed to fetch history')
  return res.json()
}

export async function dismissStale(runId, artifactId) {
  const res = await fetch(
    `${BASE}/generations/${runId}/artifacts/${artifactId}/dismiss-stale`,
    { method: 'POST' }
  )
  if (!res.ok) throw new Error('Failed to dismiss stale warning')
}
