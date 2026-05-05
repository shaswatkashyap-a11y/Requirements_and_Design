import { createSlice } from '@reduxjs/toolkit'

const refinementSlice = createSlice({
  name: 'refinement',
  initialState: {
    artifactStates: {},
  },
  reducers: {
    setRefining(state, { payload: id }) {
      state.artifactStates[id] = { status: 'refining' }
    },
    setRefined(state, { payload: { id, newVersionId } }) {
      state.artifactStates[id] = { status: 'idle', newVersionId }
    },
    setError(state, { payload: { id, error } }) {
      state.artifactStates[id] = { status: 'error', error }
    },
    setSaving(state, { payload: id }) {
      state.artifactStates[id] = { status: 'saving' }
    },
    resetArtifact(state, { payload: id }) {
      delete state.artifactStates[id]
    },
  },
})

export const { setRefining, setRefined, setError, setSaving, resetArtifact } =
  refinementSlice.actions
export default refinementSlice.reducer
