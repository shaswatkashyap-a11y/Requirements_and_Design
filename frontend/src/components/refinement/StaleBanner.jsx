import { AlertTriangle } from 'lucide-react'
import { dismissStale } from '../../api/refinementApi'

export default function StaleBanner({ artifact, runId, onDismiss, onRegenerate }) {
  async function handleDismiss() {
    await dismissStale(runId, artifact.id)
    onDismiss?.()
  }

  return (
    <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
      <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-amber-800 font-medium">Upstream dependency was refined</p>
        <p className="text-amber-600 mt-0.5">
          This artifact was generated from an earlier version. It may no longer be accurate.
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onRegenerate}
          className="px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600"
        >
          Re-generate
        </button>
        <button
          onClick={handleDismiss}
          className="px-2 py-1 border border-amber-300 text-amber-700 rounded hover:bg-amber-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
