const BASE = '/api'

export async function fetchProjects() {
  const res = await fetch(`${BASE}/projects/?limit=100`)
  if (!res.ok) throw new Error('Failed to fetch projects')
  return res.json()
}

export async function createProject(data) {
  const res = await fetch(`${BASE}/projects/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to create project')
  return res.json()
}

export async function deleteProject(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
  return res.ok
}

export async function uploadSOW(projectId, file) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/projects/${projectId}/sow/upload`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error('Failed to upload SOW')
  return res.json()
}

export async function parseSOW(projectId, sowId) {
  const res = await fetch(`${BASE}/projects/${projectId}/sow/${sowId}/parse`, {
    method: 'POST',
  })
  if (!res.ok) throw new Error('Failed to parse SOW')
  return res.json()
}

export async function fetchProjectLatestSOW(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/sow`)
  if (res.status === 204) return null
  if (!res.ok) throw new Error('Failed to fetch project SOW')
  return res.json()
}

export async function fetchSOW(projectId, sowId) {
  const res = await fetch(`${BASE}/projects/${projectId}/sow/${sowId}`)
  if (!res.ok) throw new Error('Failed to fetch SOW')
  return res.json()
}

export async function fetchSOWSections(projectId, sowId, sectionType) {
  const url = sectionType
    ? `${BASE}/projects/${projectId}/sow/${sowId}/sections?section_type=${sectionType}`
    : `${BASE}/projects/${projectId}/sow/${sowId}/sections`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch SOW sections')
  return res.json()
}

export async function fetchSOWTables(projectId, sowId) {
  const res = await fetch(`${BASE}/projects/${projectId}/sow/${sowId}/tables`)
  if (!res.ok) throw new Error('Failed to fetch SOW tables')
  return res.json()
}

export async function fetchProject(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}`)
  if (!res.ok) throw new Error('Failed to fetch project')
  return res.json()
}