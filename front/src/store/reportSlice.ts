import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiService from '../services/api';
import { Report, ReportMeta, ScanResult } from '../types';

interface ReportState {
  isLoading: boolean;
  error: string | null;
  currentReport: Report | null;
  reportList: ReportMeta[];
}

const initialState: ReportState = {
  isLoading: false,
  error: null,
  currentReport: null,
  reportList: [],
};

export const generateReport = createAsyncThunk(
  'report/generateReport',
  async (scanId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.generateReport(scanId);
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '보고서 생성 중 오류가 발생했습니다.');
      }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || '보고서 생성 중 오류가 발생했습니다.');
    }
  }
);

export const fetchReportList = createAsyncThunk(
  'report/fetchReportList',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiService.getReportList();
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '보고서 목록을 가져오는 중 오류가 발생했습니다.');
      }
      return response.data.reports || [];
    } catch (error: any) {
      return rejectWithValue(error.message || '보고서 목록을 가져오는 중 오류가 발생했습니다.');
    }
  }
);

export const fetchReportById = createAsyncThunk(
  'report/fetchReportById',
  async (reportId: string, { rejectWithValue }) => {
    try {
      const response = await apiService.getReportById(reportId);
      if (response.status >= 400) {
        return rejectWithValue(response.data.error || '보고서를 가져오는 중 오류가 발생했습니다.');
      }
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || '보고서를 가져오는 중 오류가 발생했습니다.');
    }
  }
);

const reportSlice = createSlice({
  name: 'report',
  initialState,
  reducers: {
    resetReportError: (state) => {
      state.error = null;
    },
    clearCurrentReport: (state) => {
      state.currentReport = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateReport.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateReport.fulfilled, (state, action: PayloadAction<Report>) => {
        state.isLoading = false;
        state.currentReport = action.payload;
      })
      .addCase(generateReport.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchReportList.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReportList.fulfilled, (state, action: PayloadAction<ReportMeta[]>) => {
        state.isLoading = false;
        state.reportList = action.payload;
      })
      .addCase(fetchReportList.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchReportById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReportById.fulfilled, (state, action: PayloadAction<Report>) => {
        state.isLoading = false;
        state.currentReport = action.payload;
      })
      .addCase(fetchReportById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { resetReportError, clearCurrentReport } = reportSlice.actions;
export default reportSlice.reducer;