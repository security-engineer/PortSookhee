import { configureStore } from '@reduxjs/toolkit';
import scanReducer from './slices/scanSlice';
import vulnerabilityReducer from './slices/vulnerabilitySlice';
import reportReducer from './slices/reportSlice';
import vpnReducer from './slices/vpnSlice';

export const store = configureStore({
  reducer: {
    scan: scanReducer,
    vulnerability: vulnerabilityReducer,
    report: reportReducer,
    vpn: vpnReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 