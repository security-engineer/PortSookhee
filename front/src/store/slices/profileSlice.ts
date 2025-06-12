import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProfileState {
  profiles: { id: string; name: string }[];
  activeProfileId: string | null;
}

const initialState: ProfileState = {
  profiles: [{ id: 'default', name: 'Default Profile' }],
  activeProfileId: 'default',
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    addProfile: (state, action: PayloadAction<{ id: string; name:string }>) => {
      if (!state.profiles.some(p => p.id === action.payload.id)) {
        state.profiles.push(action.payload);
      }
    },
    setActiveProfile: (state, action: PayloadAction<string>) => {
      state.activeProfileId = action.payload;
    },
    removeProfile: (state, action: PayloadAction<string>) => {
        state.profiles = state.profiles.filter(p => p.id !== action.payload);
        if (state.activeProfileId === action.payload) {
            state.activeProfileId = state.profiles[0]?.id || null;
        }
    }
  },
});

export const { addProfile, setActiveProfile, removeProfile } = profileSlice.actions;
export default profileSlice.reducer; 