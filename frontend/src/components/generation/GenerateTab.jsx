import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, History, ChevronDown, ChevronUp, Cpu, Loader2 } from 'lucide-react'
import GenerationConfig from './GenerationConfig'
import GenerationHistory from './GenerationHistory'
import { startGeneration, fetchProjectGenerations } from '../../api/generationApi'

export default function GenerateTab({ projectId, sowId, project }) {
  const navigate = useNavigate()
  const [runs, setRuns] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [configOpen, setConfigOpen] = useState(false)

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const all = await fetchProjectGenerations(projectId)
      const forThisSow = all.filter((r) => String(r.sow_id) === String(sowId))
      setRuns(forThisSow)
    } catch {
      // non-fatal
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [projectId, sowId])

  async function handleGenerate(config) {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const result = await startGeneration(projectId, sowId, config)
      navigate(`/projects/${projectId}/generations/${result.generation_run_id}`)
    } catch (err) {
      setGenerateError(err.message || 'Failed to start generation. Please try again.')
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ── New Generation button + collapsible config ────────────────────── */}
      <div>
        <button
          onClick={() => { setConfigOpen((o) => !o); setGenerateError(null) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Cpu size={14} />
          New Generation
          {configOpen
            ? <ChevronUp size={13} className="ml-1 opacity-70" />
            : <ChevronDown size={13} className="ml-1 opacity-70" />
          }
        </button>

        {/* Expandable config panel */}
        {configOpen && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl shadow-sm px-5 py-5">
            {generateError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-4">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {generateError}
              </div>
            )}
            <GenerationConfig
              project={project}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        )}
      </div>

      {/* ── Generation History (primary view) ─────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History size={14} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Generation History</h2>
          {!loadingHistory && runs.length > 0 && (
            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
              {runs.length}
            </span>
          )}
          <button
            onClick={loadHistory}
            className="ml-auto text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Refresh
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={16} className="animate-spin mr-2" />
            <span className="text-sm">Loading history…</span>
          </div>
        ) : (
          <GenerationHistory
            runs={runs}
            projectId={projectId}
            onRunsChange={loadHistory}
          />
        )}
      </div>

    </div>
  )
}
