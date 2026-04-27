import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle, CheckCircle2, ExternalLink, RotateCcw, Clock } from 'lucide-react'
import useGenerationPolling from '../hooks/useGenerationPolling'
import ProgressStepper from '../components/generation/ProgressStepper'
import StatusBadge from '../components/common/StatusBadge'
import { startGeneration } from '../api/generationApi'

function useElapsedTime(startedAt) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (!startedAt) return
    function update() {
      const diff = Math.floor((Date.now() - new Date(startedAt.endsWith('Z') ? startedAt : startedAt + 'Z')) / 1000)
      const m = Math.floor(diff / 60)
      const s = diff % 60
      setElapsed(m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return elapsed
}

export default function GenerationProgress() {
  const { projectId, runId } = useParams()
  const navigate = useNavigate()
  const { run, isPolling, error } = useGenerationPolling(runId)
  const elapsed = useElapsedTime(run?.started_at)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState(null)
  const [autoNavCountdown, setAutoNavCountdown] = useState(null)

  // Auto-navigate 2s after completion
  useEffect(() => {
    if (run?.status !== 'completed') return
    setAutoNavCountdown(2)
    const id = setInterval(() => {
      setAutoNavCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(id)
          navigate(`/projects/${projectId}/generations/${runId}/results`)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [run?.status])

  async function handleRetry() {
    if (!run) return
    setRetrying(true)
    setRetryError(null)
    try {
      const result = await startGeneration(projectId, run.sow_id, {
        methodology: run.methodology,
        service_line_codes: run.service_line_codes,
        artifact_types: run.artifact_types_requested,
      })
      navigate(`/projects/${projectId}/generations/${result.generation_run_id}`)
    } catch (err) {
      setRetryError(err.message || 'Retry failed.')
      setRetrying(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => navigate(`/projects/${projectId}/sow/${run?.sow_id || ''}`)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-5 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to SOW
      </button>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {run && (
        <>
          {/* Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <h1 className="text-lg font-bold text-gray-900 mb-1">
                  Generation Run #{run.id}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge
                    status={run.status}
                    size="lg"
                    pulse={run.status === 'extracting_modules' || run.status === 'generating_artifacts'}
                  />
                  {run.methodology && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded capitalize">
                      {run.methodology}
                    </span>
                  )}
                  {(run.service_line_codes || []).map((sl) => (
                    <span key={sl} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded">
                      {sl}
                    </span>
                  ))}
                </div>
              </div>

              {run.started_at && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Clock size={14} />
                  <span className="font-mono">{elapsed}</span>
                  <span className="text-gray-400 text-xs">elapsed</span>
                </div>
              )}
            </div>
          </div>

          {/* Progress Stepper */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm mb-5">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">
              Pipeline Progress
            </h2>
            <ProgressStepper run={run} />
          </div>

          {/* Completed banner */}
          {run.status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Generation complete!</p>
                  <p className="text-xs text-green-600">
                    All artifacts have been generated successfully.
                    {autoNavCountdown !== null && autoNavCountdown > 0 && (
                      <> Redirecting in {autoNavCountdown}s…</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate(`/projects/${projectId}/generations/${runId}/results`)}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink size={14} />
                View Results
              </button>
            </div>
          )}

          {/* Failed banner */}
          {run.status === 'failed' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-red-500" />
                <p className="text-sm font-semibold text-red-700">Generation failed</p>
              </div>
              {run.error_log && (
                <pre className="text-xs text-red-600 bg-red-100 border border-red-200 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                  {run.error_log}
                </pre>
              )}
              {retryError && (
                <p className="text-xs text-red-500">{retryError}</p>
              )}
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                <RotateCcw size={14} className={retrying ? 'animate-spin' : ''} />
                {retrying ? 'Starting retry…' : 'Retry Generation'}
              </button>
            </div>
          )}

          {/* Polling indicator */}
          {isPolling && run.status !== 'completed' && run.status !== 'failed' && (
            <p className="text-[11px] text-gray-400 text-center mt-4">
              Polling for updates every 3s…
            </p>
          )}
        </>
      )}

      {!run && !error && (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Loading generation status…</p>
          </div>
        </div>
      )}
    </div>
  )
}
