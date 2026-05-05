import { useState, useEffect } from 'react'
import { Pencil, Sparkles, RefreshCw, History, Loader2 } from 'lucide-react'
import {
  updateModule,
  refineModule,
  regenerateModuleArtifacts,
  fetchModuleVersions,
} from '../../api/moduleApi'

const SOURCE_COLORS = {
  generated: 'bg-blue-100 text-blue-700',
  refined:   'bg-indigo-100 text-indigo-700',
  manual:    'bg-gray-100 text-gray-600',
}

export default function ModuleEditPanel({
  runId,
  module,
  hasStaleArtifacts = false,
  onModuleUpdated,
  onArtifactsRegenerated,
}) {
  const [mode,           setMode]           = useState('view')
  const [editName,       setEditName]       = useState('')
  const [editDesc,       setEditDesc]       = useState('')
  const [feedback,       setFeedback]       = useState('')
  const [saving,         setSaving]         = useState(false)
  const [refining,       setRefining]       = useState(false)
  const [regenerating,   setRegenerating]   = useState(false)
  const [error,          setError]          = useState(null)
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [versions,       setVersions]       = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Reset all panel state when the selected module changes
  useEffect(() => {
    setMode('view')
    setError(null)
    setHistoryOpen(false)
    setVersions([])
  }, [module.id])

  function startEdit() {
    setEditName(module.name)
    setEditDesc(module.description || '')
    setMode('edit')
    setError(null)
  }

  function startRefine() {
    setFeedback('')
    setMode('refine')
    setError(null)
  }

  async function reloadVersions() {
    try {
      const data = await fetchModuleVersions(runId, module.id)
      setVersions(data)
    } catch {
      // non-fatal
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const updated = await updateModule(runId, module.id, { name: editName, description: editDesc })
      onModuleUpdated?.(updated)
      // Refetch so ArtifactViewer shows updated stale_status on each artifact
      onArtifactsRegenerated?.()
      // Refresh version list — new MANUAL version was just created
      await reloadVersions()
      setMode('view')
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRefine() {
    if (!feedback.trim()) return
    setRefining(true)
    setError(null)
    try {
      const updated = await refineModule(runId, module.id, feedback.trim())
      onModuleUpdated?.(updated)
      // Refetch so ArtifactViewer shows updated stale_status on each artifact
      onArtifactsRegenerated?.()
      // Refresh version list — new REFINED version was just created
      await reloadVersions()
      setMode('view')
    } catch {
      setError('Refinement failed. Please try again.')
    } finally {
      setRefining(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    setError(null)
    try {
      const updated = await regenerateModuleArtifacts(runId, module.id)
      onModuleUpdated?.(updated)
      onArtifactsRegenerated?.()
    } catch {
      setError('Regeneration failed. Please try again.')
    } finally {
      setRegenerating(false)
    }
  }

  async function toggleHistory() {
    const opening = !historyOpen
    setHistoryOpen(opening)
    if (opening) {
      // Always re-fetch on open — ensures versions added since last open appear
      setLoadingHistory(true)
      try {
        const data = await fetchModuleVersions(runId, module.id)
        setVersions(data)
      } catch {
        // non-fatal
      } finally {
        setLoadingHistory(false)
      }
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-3">

      {/* ── Header ── */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {mode === 'view' && (
            <>
              <p className="text-sm font-semibold text-gray-800 truncate">{module.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{module.description}</p>
            </>
          )}
          {mode === 'edit' && (
            <div className="flex flex-col gap-2">
              <input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-sm font-semibold text-gray-800 border border-gray-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="Module name"
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={3}
                className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 w-full resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="Module description"
              />
            </div>
          )}
          {mode === 'refine' && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium text-indigo-600 mb-0.5">AI Refinement Feedback</p>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={3}
                className="text-xs text-gray-600 border border-gray-300 rounded px-2 py-1 w-full resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                placeholder="e.g. Split this into authentication and authorization modules…"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
          {mode === 'view' && (
            <>
              <button onClick={startEdit} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors" title="Edit manually">
                <Pencil size={13} />
              </button>
              <button onClick={startRefine} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Refine with AI">
                <Sparkles size={13} />
              </button>
              <button onClick={handleRegenerate} disabled={regenerating} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40" title="Regenerate all artifacts">
                {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              </button>
              <button onClick={toggleHistory} className={`p-1.5 rounded transition-colors ${historyOpen ? 'text-indigo-600 bg-indigo-50' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`} title="Version history">
                <History size={13} />
              </button>
            </>
          )}
          {mode === 'edit' && (
            <>
              <button onClick={() => { setMode('view'); setError(null) }} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1">
                {saving ? <><Loader2 size={10} className="animate-spin" /> Saving…</> : 'Save'}
              </button>
            </>
          )}
          {mode === 'refine' && (
            <>
              <button onClick={() => { setMode('view'); setError(null) }} className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded transition-colors">
                Cancel
              </button>
              <button onClick={handleRefine} disabled={refining || !feedback.trim()} className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1">
                {refining ? <><Loader2 size={10} className="animate-spin" /> Refining…</> : <><Sparkles size={10} /> Apply</>}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-500 px-4 py-2 bg-red-50 border-t border-red-100">{error}</p>
      )}

      {hasStaleArtifacts && mode === 'view' && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
          <p className="text-[11px] text-amber-600">Artifacts may be out of date after module changes.</p>
          <button onClick={handleRegenerate} disabled={regenerating} className="text-[11px] text-amber-700 font-medium hover:underline disabled:opacity-40">
            {regenerating ? 'Regenerating…' : 'Regenerate Artifacts'}
          </button>
        </div>
      )}

      {historyOpen && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Version History</p>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <Loader2 size={12} className="animate-spin" /> Loading…
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-400">No versions recorded.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {versions.map(v => (
                <div key={v.id} className="flex items-start gap-2">
                  <span className="text-[9px] font-semibold bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-500 flex-shrink-0 mt-0.5">
                    v{v.version_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${SOURCE_COLORS[v.source] || 'bg-gray-100 text-gray-500'}`}>
                        {v.source}
                      </span>
                      <p className="text-[11px] font-medium text-gray-700 truncate">{v.name}</p>
                    </div>
                    {v.refinement_feedback && (
                      <p className="text-[10px] text-gray-400 italic mt-0.5 line-clamp-2">"{v.refinement_feedback}"</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-0.5">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
