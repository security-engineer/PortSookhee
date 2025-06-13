import { configureStore } from '@reduxjs/toolkit';
import scanReducer from './slices/scanSlice';
import vulnerabilityReducer from './slices/vulnerabilitySlice';
import reportReducer from './slices/reportSlice';
import topologyReducer from './slices/topologySlice';
import profileReducer from './slices/profileSlice';
import vpnReducer from './slices/vpnSlice';

const store = configureStore({
  reducer: {
    scan: scanReducer,
    vulnerability: vulnerabilityReducer,
    report: reportReducer,
    topology: topologyReducer,
    profile: profileReducer,
    vpn: vpnReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export default store;