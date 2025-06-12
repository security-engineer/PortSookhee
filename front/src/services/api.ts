import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 타입 정의
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export interface SearchsploitResult {
  ID: string;
  Title: string;
  Path: string;
  Type: string;
  Platform: string;
  Codes: string;
  Date: string;
}

export interface SearchsploitResponse {
  RESULTS_EXPLOIT: SearchsploitResult[];
  SEARCH_TERM: string;
}

// 요청 함수 정의
const apiService = {
  // nmap 스캔 수행
  scanNetwork: async (target: string, ports?: string, scanArguments?: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.post('/scan', {
        target,
        ports: ports || '1-1000',
        arguments: scanArguments || '-sV'
      });
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 취약점 분석
  analyzeVulnerabilities: async (scanId?: string, scanResults?: any): Promise<ApiResponse> => {
    try {
      const payload = scanId ? { scan_id: scanId } : { scan_results: scanResults };
      const response: AxiosResponse = await apiClient.post('/scan/vulns', payload);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 리포트 생성
  generateReport: async (scanId: string, vulnerabilityResults?: any): Promise<ApiResponse> => {
    try {
      // 간소화: 스캔 ID만 전달 (백엔드가 스캔 ID로부터 모든 정보를 조회하도록)
      const payload: any = { scan_id: scanId };
      
      // vulnerabilityResults가 전달된 경우 메모리 최적화를 위해 필요한 최소 정보만 추출
      if (vulnerabilityResults) {
        console.warn('취약점 분석 결과를 직접 전달하는 방식은 권장되지 않습니다. 메모리 사용량 최적화를 위해 scanId만 사용합니다.');
        // 백엔드에 취약점 결과를 전달할 필요가 없음 - 백엔드가 scanId로 검색
      }
      
      // 로깅
      console.log('리포트 생성 요청 payload:', payload);
      
      // 응답 대기 시간이 길 수 있으므로 타임아웃 설정
      const response: AxiosResponse = await apiClient.post('/report', payload, {
        timeout: 30000, // 30초 타임아웃
      });
      
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      console.error('리포트 생성 API 오류:', error);
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 저장된 스캔 목록 조회
  getScanList: async (): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.get('/scans');
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 저장된 리포트 목록 조회
  getReportList: async (): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.get('/reports');
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 특정 스캔 결과 조회
  getScanById: async (scanId: string): Promise<ApiResponse> => {
    console.log(`API: getScanById 호출 (ID: ${scanId})`);
    try {
      const response: AxiosResponse = await apiClient.get(`/scans/${scanId}`);
      console.log(`API: getScanById 응답 성공 (상태: ${response.status})`);
      console.log(`API: 응답 데이터 구조:`, {
        dataExists: !!response.data,
        scanId: response.data?.scan_id,
        target: response.data?.target,
        hostsCount: response.data?.hosts?.length || 0
      });
      
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      console.error(`API: getScanById 오류 (ID: ${scanId})`, error);
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 특정 리포트 조회
  getReportById: async (reportId: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.get(`/reports/${reportId}`);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 프로필 목록 조회
  getProfiles: async (): Promise<ApiResponse> => {
    console.log('API: getProfiles 호출');
    try {
      const response: AxiosResponse = await apiClient.get('/profiles');
      console.log('API: getProfiles 응답', response);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      console.error('API: getProfiles 오류', error);
      // 개발 환경에서는 더미 데이터 반환
      if (process.env.NODE_ENV === 'development') {
        console.log('API: getProfiles 더미 데이터 반환');
        return {
          data: {
            profiles: ['default', 'test-profile'],
            current_profile: 'default'
          },
          status: 200,
          statusText: 'OK (Dummy)',
        };
      }
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 현재 프로필 조회
  getCurrentProfile: async (): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.get('/profiles/current');
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 새 프로필 생성
  createProfile: async (profileName: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.post('/profiles', {
        profile_name: profileName,
      });
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 프로필 삭제
  deleteProfile: async (profileName: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.delete(`/profiles/${profileName}`);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // 현재 프로필 설정
  setCurrentProfile: async (profileName: string): Promise<ApiResponse> => {
    try {
      console.log('프로필 변경 요청 전송:', { profile_name: profileName });
      const response: AxiosResponse = await apiClient.post('/profiles/current', {
        profile_name: profileName,
      });
      console.log('프로필 변경 응답:', response.data);
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      console.error('프로필 변경 오류:', error.response?.data);
      return {
        data: error.response?.data || { error: '서버 연결 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // Searchsploit 검색
  searchsploit: async (query: string): Promise<ApiResponse<SearchsploitResponse>> => {
    try {
      const response: AxiosResponse = await apiClient.get('/searchsploit', {
        params: { query },
      });
      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: 'Searchsploit 검색 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },

  // Exploit 파일 다운로드
  downloadExploitFile: async (filePath: string): Promise<ApiResponse> => {
    try {
      const response: AxiosResponse = await apiClient.get('/exploit-file', {
        params: { path: filePath },
        responseType: 'blob',
      });
      
      // 파일명 추출
      const filename = filePath.split('/').pop() || 'exploit-file';
      
      // 다운로드 URL 생성 및 자동 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      
      // 링크 제거
      window.URL.revokeObjectURL(url);
      link.remove();
      
      return {
        data: { success: true, message: '파일 다운로드 성공' },
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error: any) {
      return {
        data: error.response?.data || { error: 'Exploit 파일 다운로드 오류' },
        status: error.response?.status || 500,
        statusText: error.response?.statusText || 'Server Error',
      };
    }
  },
};

export default apiService;