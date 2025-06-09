import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiService from '../services/api';
import { ScanResult, ScanMeta } from '../types';

// 슬라이스 상태 타입
interface ScanState {
  loading: boolean;
  error: string | null;
  currentScan: ScanResult | null;
  scanList: ScanMeta[];
}

// 초기 상태
const initialState: ScanState = {
  loading: false,
  error: null,
  currentScan: null,
  scanList: [],
};

// 비동기 액션 생성
export const performScan = createAsyncThunk(
  'scan/performScan',
  async ({ target, ports, arguments: args }: { target: string; ports?: string; arguments?: string }, { rejectWithValue }) => {
    try {
      const response = await apiService.scanNetwork(target, ports, args);
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '스캔 중 오류가 발생했습니다.');
      }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || '스캔 중 오류가 발생했습니다.');
    }
  }
);

export const fetchScanList = createAsyncThunk(
  'scan/fetchScanList',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getScanList();
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '스캔 목록을 가져오는 중 오류가 발생했습니다.');
      }
      return response.data.scans;
    } catch (error: any) {
      return rejectWithValue(error.message || '스캔 목록을 가져오는 중 오류가 발생했습니다.');
    }
  }
);

export const fetchScanById = createAsyncThunk(
  'scan/fetchScanById',
  async (scanId: string, { rejectWithValue }) => {
    try {
      console.log(`scanSlice: fetchScanById 액션 디스패치 (ID: ${scanId})`);
      const response = await apiService.getScanById(scanId);
      console.log(`scanSlice: 서버 응답 받음 (상태: ${response.status})`);
      
      if (response.status >= 400) {
        console.error(`scanSlice: API 오류 - ${response.data.error}`);
        return rejectWithValue(response.data.error || '스캔 결과를 가져오는 중 오류가 발생했습니다.');
      }
      
      console.log(`scanSlice: 스캔 데이터 성공적으로 받음`);
      // 스캔 데이터에 scan_id 필드가 없으면 URL에서 가져온 scanId를 추가
      const scanData = response.data;
      if (!scanData.scan_id) {
        scanData.scan_id = scanId;
        console.log(`scanSlice: scan_id 필드 추가됨 - ${scanId}`);
      }
      return scanData;
    } catch (error: any) {
      console.error(`scanSlice: 예외 발생 - ${error.message}`);
      return rejectWithValue(error.message || '스캔 결과를 가져오는 중 오류가 발생했습니다.');
    }
  }
);

// 슬라이스 생성
const scanSlice = createSlice({
  name: 'scan',
  initialState,
  reducers: {
    resetScanError: (state) => {
      state.error = null;
    },
    clearCurrentScan: (state) => {
      state.currentScan = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // performScan
      .addCase(performScan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(performScan.fulfilled, (state, action: PayloadAction<ScanResult>) => {
        state.loading = false;
        state.currentScan = action.payload;
      })
      .addCase(performScan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchScanList
      .addCase(fetchScanList.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScanList.fulfilled, (state, action: PayloadAction<ScanMeta[]>) => {
        state.loading = false;
        state.scanList = action.payload;
      })
      .addCase(fetchScanList.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchScanById
      .addCase(fetchScanById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchScanById.fulfilled, (state, action: PayloadAction<ScanResult>) => {
        state.loading = false;
        state.currentScan = action.payload;
        console.log('scanSlice: 상태 업데이트 완료, currentScan 설정됨', {
          scan_id: action.payload.scan_id,
          target: action.payload.target,
          host_count: action.payload.hosts?.length || 0
        });
      })
      .addCase(fetchScanById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.error('scanSlice: fetchScanById 실패, 에러 설정됨:', action.payload);
      });
  },
});

// 액션 내보내기
export const { resetScanError, clearCurrentScan } = scanSlice.actions;

// 리듀서 내보내기
export default scanSlice.reducer; 