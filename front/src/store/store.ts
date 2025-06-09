import { configureStore } from '@reduxjs/toolkit';
import scanReducer from './slices/scanSlice';
import vulnerabilityReducer from './vulnerabilitySlice';
import reportReducer from './reportSlice';

const store = configureStore({
  reducer: {
    scan: scanReducer,
    vulnerability: vulnerabilityReducer,
    report: reportReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;