import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { VpnService, VpnConfig, VpnStatus, VpnResponse } from '../../services/vpnService';

interface VpnState {
  configs: VpnConfig[];
  status: VpnStatus | null;
  loading: boolean;
  error: string | null;
  uploadResult: VpnResponse | null;
}

const initialState: VpnState = {
  configs: [],
  status: null,
  loading: false,
  error: null,
  uploadResult: null,
};

// 비동기 액션 생성
export const fetchConfigs = createAsyncThunk(
  'vpn/fetchConfigs',
  async () => {
    return await VpnService.getConfigs();
  }
);

export const uploadConfig = createAsyncThunk(
  'vpn/uploadConfig',
  async (file: File) => {
    return await VpnService.uploadConfig(file);
  }
);

export const deleteConfig = createAsyncThunk(
  'vpn/deleteConfig',
  async (configName: string) => {
    const response = await VpnService.deleteConfig(configName);
    return { configName, response };
  }
);

export const connectVpn = createAsyncThunk(
  'vpn/connect',
  async (configName: string) => {
    return await VpnService.connect(configName);
  }
);

export const disconnectVpn = createAsyncThunk(
  'vpn/disconnect',
  async () => {
    return await VpnService.disconnect();
  }
);

export const fetchStatus = createAsyncThunk(
  'vpn/fetchStatus',
  async () => {
    return await VpnService.getStatus();
  }
);

const vpnSlice = createSlice({
  name: 'vpn',
  initialState,
  reducers: {
    clearUploadResult: (state) => {
      state.uploadResult = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // fetchConfigs
    builder.addCase(fetchConfigs.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchConfigs.fulfilled, (state, action) => {
      state.loading = false;
      state.configs = action.payload;
    });
    builder.addCase(fetchConfigs.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || '설정 파일 로딩 중 오류 발생';
    });

    // uploadConfig
    builder.addCase(uploadConfig.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.uploadResult = null;
    });
    builder.addCase(uploadConfig.fulfilled, (state, action) => {
      state.loading = false;
      state.uploadResult = action.payload;
    });
    builder.addCase(uploadConfig.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || '설정 파일 업로드 중 오류 발생';
    });

    // deleteConfig
    builder.addCase(deleteConfig.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteConfig.fulfilled, (state, action) => {
      state.loading = false;
      // 삭제된 설정을 목록에서 제거
      const { configName } = action.payload;
      state.configs = state.configs.filter(config => config.name !== configName);
    });
    builder.addCase(deleteConfig.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || '설정 파일 삭제 중 오류 발생';
    });

    // connectVpn
    builder.addCase(connectVpn.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(connectVpn.fulfilled, (state, action) => {
      state.loading = false;
      // 상태 업데이트는 fetchStatus를 통해 처리
    });
    builder.addCase(connectVpn.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'VPN 연결 중 오류 발생';
    });

    // disconnectVpn
    builder.addCase(disconnectVpn.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(disconnectVpn.fulfilled, (state, action) => {
      state.loading = false;
      // 상태 업데이트는 fetchStatus를 통해 처리
    });
    builder.addCase(disconnectVpn.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || 'VPN 연결 종료 중 오류 발생';
    });

    // fetchStatus
    builder.addCase(fetchStatus.pending, (state) => {
      // 상태 조회는 자주 발생하므로 로딩 상태 변경 X
      state.error = null;
    });
    builder.addCase(fetchStatus.fulfilled, (state, action) => {
      state.status = action.payload;
    });
    builder.addCase(fetchStatus.rejected, (state, action) => {
      state.error = action.error.message || 'VPN 상태 조회 중 오류 발생';
    });
  }
});

export const { clearUploadResult, clearError } = vpnSlice.actions;
export default vpnSlice.reducer; 