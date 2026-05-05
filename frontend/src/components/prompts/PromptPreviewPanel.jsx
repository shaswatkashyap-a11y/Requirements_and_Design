import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { previewPrompt } from '../../api/promptApi'

export default function PromptPreviewPanel({ prompt }) {
  const [preview,  setPreview]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [feedback, setFeedback] = useState('Improve this artifact')

  if (!prompt) return null

  async function handlePreview() {
    setLoading(true)
    setError(null)
    try {
      const result = await previewPrompt({
        artifactType:   prompt.artifact_type || 'functional_req',
        methodology:    'agile',
        sampleFeedback: feedback,
      })
      setPreview(result)
    } catch {
      setError('Preview failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-96 flex-shrink-0 border-l border-gray-200 flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <p className="text-xs font-semibold text-gray-700 mb-2">Preview assembled prompt</p>
        <input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Sample feedback..."
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 mb-2 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          onClick={handlePreview}
          disabled={loading}
          className="flex items-center gap-1 px-3 py-1.5 text-xs rounded bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40 w-full justify-center"
        >
          {loading
            ? <><Loader2 size={11} className="animate-spin" /> Building…</>
            : <><Eye size={11} /> Preview</>}
        </button>
        {error && <p className="text-[10px] text-red-500 mt-1">{error}</p>}
      </div>

      {preview && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">System Prompt</p>
            <pre className="text-[10px] text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">
              {preview.system_prompt}
            </pre>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 uppercase mb-1">User Prompt</p>
            <pre className="text-[10px] text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded p-2">
              {preview.user_prompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
