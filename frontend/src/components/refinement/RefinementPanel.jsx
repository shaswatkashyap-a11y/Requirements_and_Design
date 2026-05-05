import { useState } from 'react'
import { Loader2, Sparkles, Pencil } from 'lucide-react'
import { useArtifactRefinementState } from '../../hooks/useRefineArtifact'
import InlineEditor from './InlineEditor'

export default function RefinementPanel({ artifact, runId, onRefine, onSaveEdit }) {
  const [feedback, setFeedback] = useState('')
  const [editMode, setEditMode] = useState(false)
  const state = useArtifactRefinementState(artifact.id)

  const isRefining = state.status === 'refining'
  const isSaving   = state.status === 'saving'
  const isBusy     = isRefining || isSaving

  if (editMode) {
    return (
      <InlineEditor
        initialValue={artifact.content_markdown || ''}
        onSave={(newContent) => {
          setEditMode(false)
          onSaveEdit(artifact.id, newContent, artifact.content_json)
        }}
        onCancel={() => setEditMode(false)}
      />
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex gap-2 items-start">
        <textarea
          rows={2}
          className="flex-1 text-xs rounded border border-gray-200 px-2 py-1.5
                     resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400
                     disabled:opacity-50 disabled:bg-gray-50"
          placeholder="Describe what to change — e.g. 'Focus on AWS Lambda timeout edge cases'"
          value={feedback}
          disabled={isBusy}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => { onRefine(artifact.id, feedback); setFeedback('') }}
            disabled={isBusy || feedback.trim().length < 5}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded
                       bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
          >
            {isRefining
              ? <><Loader2 size={11} className="animate-spin" /> Refining…</>
              : <><Sparkles size={11} /> Refine</>}
          </button>
          <button
            onClick={() => setEditMode(true)}
            disabled={isBusy}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded
                       border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
      </div>
      {state.status === 'error' && (
        <p className="mt-1 text-[11px] text-red-500">{state.error}</p>
      )}
    </div>
  )
}
