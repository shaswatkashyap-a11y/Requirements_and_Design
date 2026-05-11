import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { fetchPrompts }   from '../api/promptApi'
import PromptList         from '../components/prompts/PromptList'
import PromptEditPanel    from '../components/prompts/PromptEditPanel'

export default function PromptEditor() {
  const { projectId }          = useParams()
  const [prompts,  setPrompts]  = useState([])
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const hasProjectOverride = selected
  ? prompts.some(p =>
      p.project_id != null &&
      p.prompt_type === selected.prompt_type &&
      p.scope_key === selected.scope_key &&
      p.artifact_type === selected.artifact_type
    )
  : false

  useEffect(() => {
    loadPrompts()
  }, [projectId])

  async function loadPrompts() {
    setLoading(true)
    try {
      const data = await fetchPrompts(projectId ? Number(projectId) : null)
      setPrompts(data)
    } catch {
      setError('Failed to load prompts.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 size={18} className="animate-spin mr-2" />
        <span className="text-sm">Loading prompts…</span>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500 text-center py-12">{error}</p>
  }

  return (
    <div className="flex h-full min-h-0">
      <PromptList
        prompts    ={prompts}
        selectedId ={selected?.id}
        onSelect   ={setSelected}
      />
      <PromptEditPanel
        prompt    ={selected}
        projectId ={projectId ? Number(projectId) : null}
        hasProjectOverride={hasProjectOverride}
        onSaved   ={loadPrompts}
      />
    </div>
  )
}
