import { useDispatch, useSelector } from 'react-redux'
import { setRefining, setRefined, setError, setSaving } from '../store/slices/refinementSlice'
import { refineArtifact, manualEditArtifact } from '../api/refinementApi'

export default function useRefineArtifact(runId, onSuccess) {
  const dispatch = useDispatch()

  async function refine(artifactId, feedback, cascadeStale = true) {
    dispatch(setRefining(artifactId))
    try {
      const result = await refineArtifact(runId, artifactId, { feedback, cascadeStale })
      dispatch(setRefined({ id: artifactId, newVersionId: result.new_version.id }))
      onSuccess?.(artifactId, result)
    } catch (err) {
      dispatch(setError({ id: artifactId, error: err.message }))
    }
  }

  async function saveEdit(artifactId, contentMarkdown, contentJson) {
    dispatch(setSaving(artifactId))
    try {
      await manualEditArtifact(runId, artifactId, { contentMarkdown, contentJson })
      dispatch(setRefined({ id: artifactId, newVersionId: null }))
      onSuccess?.(artifactId, null)
    } catch (err) {
      dispatch(setError({ id: artifactId, error: err.message }))
    }
  }

  return { refine, saveEdit }
}

export function useArtifactRefinementState(artifactId) {
  return useSelector(
    (state) => state.refinement.artifactStates[artifactId] ?? { status: 'idle' }
  )
}
