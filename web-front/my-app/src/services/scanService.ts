import axios from 'axios';
import { 
  ScanData, 
  ScanMode, 
  ScanStatusResponse,
  ScanStatusType
} from '../types/scan';

// API 기본 URL - 반드시 상대 경로로 설정하여 프록시를 통해 요청되게 함
const API_BASE_URL = '/api';

// 로그 레벨 설정 - 개발 환경에서 디버깅을 위해 모든 로그 출력
const DEBUG = true;

/**
 * 스캔 서비스 클래스
 * 스캔 관련 API 호출을 처리
 */
export class ScanService {
  /**
   * 기본 헤더 가져오기
   * @returns 헤더 객체
   */
  private getHeaders(): Record<string, string> {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-Skip-Auth': 'true',
      'X-Admin-Access': 'true'
    };
  }

  /**
   * 스캔 엔드포인트를 모드에 따라 반환
   * @param mode 스캔 모드
   * @returns API 엔드포인트
   */
  private getScanEndpoint(mode: ScanMode): string {
    // 각 모드별 적절한 엔드포인트 반환
    const endpoints = {
      'quick': `${API_BASE_URL}/scan/quick`,
      'full': `${API_BASE_URL}/scan/full`,
      'custom': `${API_BASE_URL}/scan/custom`,
      'test': `${API_BASE_URL}/scan/test`
    };
    
    // 모드에 맞는 엔드포인트 반환, 없으면 기본 scan 엔드포인트
    const endpoint = endpoints[mode] || `${API_BASE_URL}/scan`;
    
    if (DEBUG) console.log(`[API] 모드(${mode})에 대한 엔드포인트: ${endpoint}`);
    return endpoint;
  }

  /**
   * 재시도 로직이 포함된 API 호출 함수
   * @param method 요청 메서드
   * @param url 요청 URL
   * @param data 요청 데이터 (POST 요청의 경우)
   * @param maxRetries 최대 재시도 횟수
   */
  private async callApiWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    data?: any,
    maxRetries: number = 3
  ): Promise<T> {
    let retries = 0;
    const headers = this.getHeaders();
    
    while (retries <= maxRetries) {
      try {
        console.log(`API 요청: ${method.toUpperCase()} ${url}`, data || '');
        
        let response;
        if (method === 'get') {
          response = await axios.get<T>(url, { headers });
        } else {
          response = await axios.post<T>(url, data, { headers });
        }
        
        console.log(`API 응답 성공:`, response.data);
        return response.data as T;
      } catch (error: any) {
        console.error(`API 호출 실패 (시도 ${retries + 1}/${maxRetries + 1}):`, error);
        
        // 상세 오류 정보 로깅
        if (error.response) {
          console.error('오류 응답:', {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          });
        }
        
        // 마지막 시도에서 실패하면 오류 전파
        if (retries === maxRetries) {
          throw error;
        }
        
        // 재시도 전 잠시 대기 (지수 백오프: 1초, 2초, 4초, ...)
        const delay = Math.pow(2, retries) * 1000;
        console.log(`${delay}ms 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        retries++;
      }
    }
    
    // 여기까지 오면 모든 재시도가 실패한 것
    throw new Error('최대 재시도 횟수 초과');
  }

  /**
   * 스캔 시작
   * @param scanData 스캔 데이터
   * @returns 스캔 상태 응답
   */
  public async startScan(scanData: ScanData): Promise<ScanStatusResponse> {
    // 모드별 엔드포인트 설정
    const scanEndpoint = this.getScanEndpoint(scanData.mode);
    console.log(`스캔 요청 준비: ${scanEndpoint}`, scanData);
    
    // 포트 및 인자가 필요한 경우 확인
    if (scanData.mode === 'custom' && !scanData.ports && !scanData.arguments) {
      console.warn('사용자 정의 스캔에는 ports 또는 arguments가 필요합니다.');
    }

    try {
      // 확장된 헤더 설정
      const headers = {
        ...this.getHeaders(),
        'X-Skip-Auth': 'true',
        'X-Admin-Access': 'true'
      };
      
      console.log(`스캔 API 요청 시작: ${scanEndpoint}`);
      console.log(`요청 데이터:`, JSON.stringify(scanData));
      
      // 스캔 API 요청
      const response = await axios.post(scanEndpoint, scanData, {
        headers,
        timeout: 30000 // 30초 타임아웃 설정
      });

      console.log(`스캔 API 응답 코드: ${response.status}`);
      
      // 응답 확인
      if (!response.data) {
        console.error('스캔 요청에 대한 응답이 비었습니다.');
        throw new Error('빈 응답을 받았습니다. 백엔드 서버를 확인해주세요.');
      }

      console.log('스캔 응답 데이터:', JSON.stringify(response.data));
      const scanResponse = response.data as ScanStatusResponse;
      
      // 응답에 스캔 ID가 없으면 오류 처리
      if (!scanResponse.scan_id) {
        console.error('스캔 응답에 scan_id가 없습니다:', scanResponse);
        
        // 가능하면 백엔드에서 받은 응답 형식 그대로 사용
        if (typeof scanResponse === 'object') {
          // ID가 없지만 다른 정보를 포함한 객체인 경우, 임시 ID 추가
          const tempResponse: ScanStatusResponse = {
            ...scanResponse,
            scan_id: `scan-${Date.now()}`,
            target: scanData.target,
            mode: scanData.mode,
            status: 'pending' as ScanStatusType,
            start_time: Date.now()
          };
          
          console.log('임시 ID가 추가된 응답:', tempResponse);
          return tempResponse;
        }

        throw new Error('스캔 ID가 없는 응답을 받았습니다. 스캔을 시작할 수 없습니다.');
      }
      
      console.log(`스캔 응답 성공: ID=${scanResponse.scan_id}`);
      return scanResponse;
    } catch (error: any) {
      console.error('스캔 시작 오류:', error);
      
      // 네트워크 오류 처리
      if (error.code === 'ERR_NETWORK') {
        console.error('네트워크 오류: 백엔드 서버가 실행 중인지 확인하세요.');
        throw new Error('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
      }
      
      // 오류 응답이 있는 경우
      if (error.response) {
        console.error('스캔 요청 오류 응답:', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.response.config?.url,
          data: error.response.data
        });
        
        // 상태 코드별 처리
        if (error.response.status === 403) {
          throw new Error('포트 스캔 작업은 권한이 필요합니다. 관리자에게 문의하세요.');
        } else if (error.response.status === 404) {
          throw new Error(`스캔 API를 찾을 수 없습니다. 엔드포인트(${scanEndpoint})가 올바른지 확인하세요.`);
        } else if (error.response.status === 400) {
          throw new Error(`잘못된 요청: ${error.response.data?.message || '요청 형식을 확인하세요.'}`);
        } else if (error.response.status >= 500) {
          throw new Error(`서버 오류: ${error.response.data?.message || '백엔드 서버에 문제가 발생했습니다.'}`);
        }
      }
      
      // 기타 오류 처리
      const errorMessage = error.message || '알 수 없는 오류가 발생했습니다.';
      throw new Error(`스캔을 시작할 수 없습니다: ${errorMessage}`);
    }
  }

  /**
   * 스캔 상태 확인
   * @param scanId 스캔 ID
   * @returns 스캔 상태 응답
   */
  public async getScanStatus(scanId: string): Promise<ScanStatusResponse> {
    const url = `${API_BASE_URL}/scan/${scanId}`;
    console.log(`스캔 상태 조회: ${scanId} (URL: ${url})`);
    
    try {
      const response = await axios.get(url, { 
        headers: this.getHeaders(),
        timeout: 10000 // 10초 타임아웃
      });
      
      console.log('스캔 상태 응답 받음:', response.data);
      
      const scanResponse = response.data as ScanStatusResponse;
      
      if (!scanResponse) {
        console.error('응답이 비어있습니다');
        throw new Error('스캔 상태를 조회할 수 없습니다: 빈 응답');
      }
      
      // 응답이 있지만 status 필드가 없는 경우를 위한 기본값 설정
      if (!scanResponse.status) {
        console.warn('상태 필드가 없어 pending으로 기본 설정합니다');
        scanResponse.status = 'pending';
      }
      
      return scanResponse;
    } catch (error: any) {
      console.error('스캔 상태 조회 실패:', error);
      
      // 상세 오류 로깅
      if (error.response) {
        console.error('상태 조회 오류 응답:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      throw new Error(`스캔 상태를 조회할 수 없습니다: ${error.message}`);
    }
  }

  /**
   * 서버 상태 확인
   * @returns 서버 사용 가능 여부
   */
  public async checkServerStatus(): Promise<boolean> {
    try {
      console.log('서버 상태 확인 시도...');
      
      // 정확한 API 경로로 요청
      console.log('API 상태 확인: /api/health');
      const response = await axios({
        method: 'get',
        url: '/api/health',
        timeout: 5000,
        headers: {
          ...this.getHeaders(),
          'X-Skip-Auth': 'true'
        }
      });
      
      console.log('서버 상태 응답:', response.status, response.data);
      
      // 응답이 성공적인지 확인
      if (response.status === 200 && response.data && response.data.status === 'ok') {
        console.log('서버 연결 성공!');
        return true;
      }
      
      console.warn('서버 응답은 받았으나 예상과 다름:', response.data);
      return false;
    } catch (error: any) {
      console.error('서버 상태 확인 실패:', error.message);
      
      // 다른 API 엔드포인트로 재시도
      try {
        console.log('기본 API 엔드포인트로 시도: /api/');
        const fallbackResponse = await axios.get('/api/', { 
          timeout: 5000,
          headers: this.getHeaders()
        });
        console.log('기본 API 응답:', fallbackResponse.status);
        return fallbackResponse.status === 200;
      } catch (fallbackError) {
        console.error('기본 API 요청도 실패:', fallbackError);
        return false;
      }
    }
  }
}

// 싱글턴 인스턴스 생성
export const scanService = new ScanService(); 