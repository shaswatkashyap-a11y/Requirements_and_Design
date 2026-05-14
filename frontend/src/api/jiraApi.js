const BASE = '/api'

export async function saveJiraConfig(projectId, config) {
  const r = await fetch(`${BASE}/projects/${projectId}/jira/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  if (!r.ok) throw new Error((await r.json()).detail || 'Failed to save Jira config')
  return r.json()
}

export async function testJiraConnection(projectId) {
  const r = await fetch(`${BASE}/projects/${projectId}/jira/test`, { method: 'POST' })
  if (!r.ok) throw new Error((await r.json()).detail || 'Connection failed')
  return r.json()
}

export async function pushToJira(projectId, payload) {
  const r = await fetch(`${BASE}/projects/${projectId}/jira/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error((await r.json()).detail || 'Push failed')
  return r.json()
}

export async function fetchJiraConfig(projectId) {
  const r = await fetch(`${BASE}/projects/${projectId}/jira/config`)
  if (!r.ok) throw new Error('Failed to fetch Jira config')
  return r.json()
}

export async function fetchJiraPushStatus(projectId, generationRunId) {
  const r = await fetch(`${BASE}/projects/${projectId}/jira/status?generation_run_id=${generationRunId}`)
  if (!r.ok) throw new Error('Failed to fetch Jira status')
  return r.json()
}
