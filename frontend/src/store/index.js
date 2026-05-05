import { configureStore } from '@reduxjs/toolkit'
import validationReducer from './slices/validationSlice'
import refinementReducer from './slices/refinementSlice'

export const store = configureStore({
  reducer: {
    validation: validationReducer,
    refinement: refinementReducer,
  },
})
