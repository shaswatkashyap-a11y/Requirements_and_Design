import { createSlice } from '@reduxjs/toolkit'

const validationSlice = createSlice({
  name: 'validation',
  initialState: {
    resultsByRun: {},   // runId → validation data
    loadingByRun: {},   // runId → true/false
    errorByRun: {},     // runId → error message
  },
  reducers: {
    setValidationLoading(state, action) {
      const { runId } = action.payload
      state.loadingByRun[runId] = true
      delete state.errorByRun[runId]
      delete state.resultsByRun[runId]
    },
    setValidationResult(state, action) {
      const { runId, data } = action.payload
      state.resultsByRun[runId] = data
      state.loadingByRun[runId] = false
    },
    setValidationError(state, action) {
      const { runId, error } = action.payload
      state.errorByRun[runId] = error
      state.loadingByRun[runId] = false
    },
    clearValidationResult(state, action) {
      const { runId } = action.payload
      delete state.resultsByRun[runId]
      delete state.loadingByRun[runId]
      delete state.errorByRun[runId]
    },
  },
})

export const {
  setValidationLoading,
  setValidationResult,
  setValidationError,
  clearValidationResult,
} = validationSlice.actions
export default validationSlice.reducer
