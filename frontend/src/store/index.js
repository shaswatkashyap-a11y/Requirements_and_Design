import { configureStore } from '@reduxjs/toolkit'
import validationReducer from './slices/validationSlice'

export const store = configureStore({
  reducer: {
    validation: validationReducer,
  },
})
