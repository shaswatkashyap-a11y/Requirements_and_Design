import { useState, useEffect } from 'react'
import { History, X } from 'lucide-react'
import { fetchArtifactHistory, manualEditArtifact } from '../../api/refinementApi'

const SOURCE_LABELS = {
  generated: { label: 'Generated',    color: 'bg-blue-100 text-blue-700' },
  refined:   { label: 'AI Refined',   color: 'bg-purple-100 text-purple-700' },
  manual:    { label: 'Manual Edit',  color: 'bg-green-100 text-green-700' },
}

export default function VersionHistoryDrawer({ artifact, runId, onClose, onRestore }) {
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError]   = useState(null)
  const [restoreError, setRestoreError] = useState(null)

  useEffect(() => {
    setFetchError(null)
    fetchArtifactHistory(runId, artifact.id)
      .then(setHistory)
      .catch(() => setFetchError('Failed to load version history.'))
      .finally(() => setLoading(false))
  }, [artifact.id, runId])

  async function handleRestore(version) {
    setRestoreError(null)
    try {
      await manualEditArtifact(runId, artifact.id, {
        contentMarkdown: version.content_markdown,
        contentJson:     version.content_json,
      })
      onRestore?.()
      onClose()
    } catch {
      setRestoreError('Restore failed. Please try again.')
    }
  }

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <History size={14} />
          Version History
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {restoreError && (
        <p className="text-[11px] text-red-500 px-4 py-2 bg-red-50 border-b border-red-100">
          {restoreError}
        </p>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
        ) : fetchError ? (
          <p className="text-xs text-red-500 text-center py-8">{fetchError}</p>
        ) : history.map((v) => {
          const badge     = SOURCE_LABELS[v.source] || SOURCE_LABELS.generated
          const isCurrent = v.id === artifact.current_version_id

          return (
            <div key={v.id} className={`px-4 py-3 ${isCurrent ? 'bg-indigo-50' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono font-bold text-gray-600">v{v.version_number}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.color}`}>
                  {badge.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-indigo-600 font-semibold">Current</span>
                )}
              </div>
              {v.refinement_feedback && (
                <p className="text-[11px] text-gray-500 italic mb-1">"{v.refinement_feedback}"</p>
              )}
              <p className="text-[10px] text-gray-400 mb-2">
                {new Date(v.created_at).toLocaleString()}
              </p>
              {!isCurrent && (
                <button
                  onClick={() => handleRestore(v)}
                  className="text-[11px] text-indigo-600 hover:underline"
                >
                  Restore this version
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
