import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiService from '../../services/api';
import { Report, ReportMeta, ScanResult } from '../../types';

// 상태 타입 정의
interface ReportState {
  reports: ReportMeta[];
  currentReport: Report | null;
  loading: boolean;
  error: string | null;
}

// 초기 상태
const initialState: ReportState = {
  reports: [],
  currentReport: null,
  loading: false,
  error: null,
};

// 비동기 Thunk: 보고서 생성
export const generateReport = createAsyncThunk(
  'report/generate',
  async (scanId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.generateReport(scanId);
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '보고서 생성 중 오류가 발생했습니다.');
      }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error || '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 슬라이스 생성
const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCurrentReport: (state, action: PayloadAction<any>) => {
      state.currentReport = action.payload;
      // 로그 추가
      console.log('[Redux] 보고서 데이터 설정:', action.payload?.report_id || '데이터 없음');
    },
    clearCurrentReport: (state) => {
      state.currentReport = null;
      // 로그 추가
      console.log('[Redux] 현재 보고서 데이터 지움');
    }
  },
  extraReducers: (builder) => {
    builder
      // 보고서 생성
      .addCase(generateReport.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(generateReport.fulfilled, (state, action: PayloadAction<Report>) => {
        state.loading = false;
        state.currentReport = action.payload;
        // 보고서 목록에 메타데이터 추가 (중복 방지)
        const existingReport = state.reports.find(r => r.id === action.payload.report_id);
        if (!existingReport && action.payload.report_id) {
          state.reports.push({
            id: action.payload.report_id,
            timestamp: action.payload.timestamp,
            summary: action.payload.summary,
            filename: `${action.payload.report_id}.json`,
            path: ''
          });
        }
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCurrentReport, clearCurrentReport } = reportSlice.actions;
export default reportSlice.reducer; 