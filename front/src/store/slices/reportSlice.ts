import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiService from '../../services/api';
import { Report, ReportMeta, ReportSummary, ScanResult } from '../../types';

// generateReport Thunk가 반환할 타입 정의 (메모리 최적화)
type GeneratedReportMetadata = {
  report_id: string;
  timestamp: string;
  target: string;
  summary: ReportSummary;
}

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
export const generateReport = createAsyncThunk<GeneratedReportMetadata, string>(
  'report/generate',
  async (scanId: string, { rejectWithValue }) => {
    try {
      // 리포트 생성 시작 로그
      console.log('리포트 생성 시작 - scanId:', scanId);
      
      // 메모리 최적화: 응답에서 필요한 데이터만 처리
      const response = await apiService.generateReport(scanId);
      
      if (response.status >= 400) {
        console.error('리포트 생성 API 오류:', response.data.error);
        return rejectWithValue(response.data.error || '보고서 생성 중 오류가 발생했습니다.');
      }
      
      // 응답 데이터를 메모리에 저장하기 전에 필요한 정보만 추출하여 반환
      const reportData = response.data as Report;
      
      // 응답 크기 로깅
      console.log('리포트 생성 완료 - 응답 크기:', 
        JSON.stringify(reportData).length,
        '바이트');
      
      // 메모리 최적화를 위해 전체 데이터 대신 메타데이터만 반환
      return {
        report_id: reportData.report_id,
        timestamp: reportData.timestamp,
        target: reportData.details.target,
        summary: reportData.summary
      };
    } catch (error: any) {
      console.error('리포트 생성 중 예외 발생:', error);
      return rejectWithValue(error.response?.data?.error || '알 수 없는 오류가 발생했습니다.');
    }
  }
);

// 비동기 Thunk: 보고서 ID로 불러오기
export const fetchReportById = createAsyncThunk<Report, string>(
  'report/fetchById',
  async (report_id, { rejectWithValue }) => {
    try {
      console.log(`reportSlice: fetchReportById 액션 디스패치 (ID: ${report_id})`);
      const response = await apiService.getReportById(report_id);
      
      if (response.status >= 400) {
        console.error(`reportSlice: API 오류 - ${response.data.error}`);
        return rejectWithValue(response.data.error || '보고서를 불러오는 중 오류가 발생했습니다.');
      }
      
      console.log(`reportSlice: 보고서 데이터 성공적으로 받음`);
      return response.data as Report;
    } catch (error: any) {
      console.error(`reportSlice: 예외 발생 - ${error.message}`);
      return rejectWithValue(error.response?.data?.error || '보고서를 불러오는 중 오류가 발생했습니다.');
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
      .addCase(generateReport.fulfilled, (state, action: PayloadAction<GeneratedReportMetadata>) => {
        state.loading = false;
        // 중요: currentReport를 여기서 설정하지 않음으로써 메모리 문제를 해결
        // state.currentReport = action.payload;
        
        // 보고서 목록에 메타데이터 추가 (중복 방지)
        const newReportMeta = action.payload;
        const existingReport = state.reports.find(r => r.id === newReportMeta.report_id);

        if (!existingReport && newReportMeta.report_id) {
          state.reports.push({
            id: newReportMeta.report_id,
            timestamp: newReportMeta.timestamp,
            target: newReportMeta.target,
            filename: `${newReportMeta.report_id}.json`,
            path: '',
            summary: newReportMeta.summary,
          });
        }
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // 보고서 ID로 불러오기
      .addCase(fetchReportById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReportById.fulfilled, (state, action: PayloadAction<Report>) => {
        state.loading = false;
        state.currentReport = action.payload;
        console.log('reportSlice: 상태 업데이트 완료, currentReport 설정됨', {
          report_id: action.payload.report_id,
          timestamp: action.payload.timestamp
        });
      })
      .addCase(fetchReportById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.error('reportSlice: fetchReportById 실패, 에러 설정됨:', action.payload);
      });
  },
});

export const { clearError, setCurrentReport, clearCurrentReport } = reportSlice.actions;
export default reportSlice.reducer; 