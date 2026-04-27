import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink, Clock, XCircle, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import StatusBadge from '../common/StatusBadge'
import { cancelGenerationRun, deleteGenerationRun } from '../../api/generationApi'

const ARTIFACT_DISPLAY_NAMES = {
  functional_req:       'Func. Req.',
  nonfunctional_req:    'Non-Func.',
  task:                 'Tasks',
  test_case:            'Test Cases',
  architecture:         'Architecture',
  risk_entry:           'Risks',
  component_design:     'Comp. Design',
  data_model:           'Data Model',
  traceability_matrix:  'Traceability',
}

const IN_PROGRESS_STATUSES = ['pending', 'queued', 'extracting_modules', 'generating_artifacts']
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

// Backend returns timestamps without timezone suffix — treat them as UTC.
const asUTC = iso => iso && !iso.endsWith('Z') ? iso + 'Z' : iso

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(asUTC(iso)).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function calcDurationMs(start, end) {
  if (!start) return null
  return (end ? new Date(asUTC(end)) : new Date()) - new Date(asUTC(start))
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return `${h}h ${rem}m`
}

function isStale(run) {
  if (!IN_PROGRESS_STATUSES.includes(run.status)) return false
  const ms = calcDurationMs(run.started_at, null)
  return ms != null && ms > STALE_THRESHOLD_MS
}

// ── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs text-white rounded-lg font-medium transition-colors ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Row-level action buttons ─────────────────────────────────────────────────
function ActionCell({ run, projectId, onCancel, onDelete, navigate }) {
  const [pendingAction, setPendingAction] = useState(null) // 'cancel' | 'delete' | null
  const [busy, setBusy] = useState(false)

  const stale = isStale(run)
  const inProgress = IN_PROGRESS_STATUSES.includes(run.status) && !stale

  async function execCancel() {
    setPendingAction(null)
    setBusy(true)
    try {
      await cancelGenerationRun(run.id)
      onCancel(run.id)
    } catch {
      // fail silently — backend will surface the error on next poll
    } finally {
      setBusy(false)
    }
  }

  async function execDelete() {
    setPendingAction(null)
    setBusy(true)
    try {
      await deleteGenerationRun(run.id)
      onDelete(run.id)
    } catch {
      setBusy(false)
    }
  }

  if (busy) {
    return <Loader2 size={13} className="animate-spin text-gray-400" />
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {/* View Results — completed */}
        {run.status === 'completed' && (
          <button
            onClick={() => navigate(`/projects/${projectId}/generations/${run.id}/results`)}
            className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <ExternalLink size={11} />
            View Results
          </button>
        )}

        {/* View Progress — in progress (non-stale) */}
        {inProgress && (
          <button
            onClick={() => navigate(`/projects/${projectId}/generations/${run.id}`)}
            className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
          >
            <ExternalLink size={11} />
            Progress
          </button>
        )}

        {/* Cancel — in-progress or stale */}
        {(inProgress || stale) && (
          <button
            onClick={() => setPendingAction('cancel')}
            className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-800 font-medium transition-colors"
          >
            <XCircle size={11} />
            Cancel
          </button>
        )}

        {/* Delete — failed (includes cancelled + timed out) */}
        {(run.status === 'failed' && !inProgress && !stale) && (
          <button
            onClick={() => setPendingAction('delete')}
            className="flex items-center gap-1 text-[11px] text-red-500 hover:text-red-700 font-medium transition-colors"
          >
            <Trash2 size={11} />
            Delete
          </button>
        )}

        {run.status !== 'completed' && !inProgress && !stale && run.status !== 'failed' && (
          <span className="text-gray-300">—</span>
        )}
      </div>

      {pendingAction === 'cancel' && (
        <ConfirmDialog
          title="Cancel this run?"
          message="The generation will be marked as failed. Any partially generated artifacts will be kept but the run will not resume."
          confirmLabel="Yes, Cancel Run"
          confirmColor="bg-orange-600 hover:bg-orange-700"
          onConfirm={execCancel}
          onCancel={() => setPendingAction(null)}
        />
      )}

      {pendingAction === 'delete' && (
        <ConfirmDialog
          title="Delete this run?"
          message="This will permanently delete the generation run and ALL its modules and artifacts. This cannot be undone."
          confirmLabel="Delete Run"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={execDelete}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GenerationHistory({ runs: initialRuns, projectId, onRunsChange }) {
  const navigate = useNavigate()
  const [runs, setRuns] = useState(initialRuns || [])

  // Keep in sync if parent reloads
  if (initialRuns && initialRuns !== runs && initialRuns.length !== runs.length) {
    setRuns(initialRuns)
  }

  function handleCancel(runId) {
    setRuns((prev) =>
      prev.map((r) =>
        r.id === runId
          ? { ...r, status: 'failed', error_log: 'Cancelled by user.', completed_at: new Date().toISOString() }
          : r
      )
    )
    onRunsChange?.()
  }

  function handleDelete(runId) {
    setRuns((prev) => prev.filter((r) => r.id !== runId))
    onRunsChange?.()
  }

  if (!runs || runs.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-8">
        No previous generation runs for this SOW.
      </p>
    )
  }

  const sorted = [...runs].sort((a, b) => new Date(asUTC(b.created_at)) - new Date(asUTC(a.created_at)))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Run</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Methodology</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Artifact Types</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Started</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
            <th className="px-3 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((run, i) => {
            const stale = isStale(run)
            const durationMs = calcDurationMs(run.started_at, run.completed_at)

            return (
              <tr key={run.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2.5 font-mono text-gray-700">#{run.id}</td>

                {/* Status — override with "Timed Out" for stale in-progress runs */}
                <td className="px-3 py-2.5">
                  {stale ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border bg-red-100 text-red-700 border-red-200">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                      Timed Out
                    </span>
                  ) : (
                    <StatusBadge
                      status={run.status}
                      pulse={run.status === 'generating_artifacts' || run.status === 'extracting_modules'}
                    />
                  )}
                </td>

                <td className="px-3 py-2.5 capitalize text-gray-700">{run.methodology || '—'}</td>

                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {(run.artifact_types_requested || []).slice(0, 4).map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded">
                        {ARTIFACT_DISPLAY_NAMES[t] || t}
                      </span>
                    ))}
                    {(run.artifact_types_requested || []).length > 4 && (
                      <span className="text-[10px] text-gray-400">
                        +{run.artifact_types_requested.length - 4} more
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <Clock size={10} className="text-gray-400" />
                    {formatDate(run.created_at)}
                  </span>
                </td>

                <td className={`px-3 py-2.5 whitespace-nowrap font-mono ${stale ? 'text-red-500 font-semibold' : 'text-gray-500'}`}>
                  {formatDuration(durationMs)}
                </td>

                <td className="px-3 py-2.5">
                  <ActionCell
                    run={run}
                    projectId={projectId}
                    onCancel={handleCancel}
                    onDelete={handleDelete}
                    navigate={navigate}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
