const BASE = 'http://localhost:8000/api'

// ── Service Lines ─────────────────────────────────────────────────────────────

export async function addServiceLine(formData) {
  const res = await fetch(`${BASE}/config/service-lines`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to add service line')
  }
  return res.json()
}

export async function deleteServiceLine(id) {
  const res = await fetch(`${BASE}/config/service-lines/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete service line')
  }
  return res.json()
}

export async function deleteServiceLineByCode(code) {
  const res = await fetch(`${BASE}/config/service-lines/by-code/${code}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete service line')
  }
  return res.json()
}

// ── Methodologies ─────────────────────────────────────────────────────────────

export async function addMethodology(formData) {
  const res = await fetch(`${BASE}/config/methodologies`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to add methodology')
  }
  return res.json()
}

export async function deleteMethodology(id) {
  const res = await fetch(`${BASE}/config/methodologies/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete methodology')
  }
  return res.json()
}

export async function deleteMethodologyByCode(code) {
  const res = await fetch(`${BASE}/config/methodologies/by-code/${code}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to delete methodology')
  }
  return res.json()
}
