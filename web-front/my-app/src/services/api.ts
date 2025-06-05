import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';

/**
 * 기본 API 클라이언트 클래스
 * 객체지향적이고 재사용 가능한 API 요청 처리
 */
export class ApiClient {
  private client: AxiosInstance;

  /**
   * API 클라이언트 생성자
   * @param baseURL API 기본 URL
   * @param timeout 요청 타임아웃 (ms)
   */
  constructor(baseURL: string, timeout: number = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * 인터셉터 설정
   */
  private setupInterceptors(): void {
    // 요청 인터셉터
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(`요청 시작: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error: AxiosError) => {
        console.error('요청 인터셉터 오류:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`응답 성공: ${response.status} ${response.config.url}`);
        return response;
      },
      (error: AxiosError) => {
        console.error('응답 오류:', error);
        
        // 오류 세부 정보 로깅
        if (error.response) {
          console.error('응답 데이터:', error.response.data);
          console.error('응답 상태:', error.response.status);
        } else if (error.request) {
          console.error('응답 없음:', error.request);
        } else {
          console.error('요청 오류:', error.message);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET 요청 수행
   * @param url 요청 URL
   * @param config 추가 요청 설정
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  /**
   * POST 요청 수행
   * @param url 요청 URL
   * @param data 요청 데이터
   * @param config 추가 요청 설정
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  /**
   * 재시도 로직이 포함된 API 호출 함수
   * @param method 요청 메서드
   * @param url 요청 URL
   * @param data 요청 데이터 (POST 요청의 경우)
   * @param maxRetries 최대 재시도 횟수
   */
  public async callWithRetry<T>(
    method: 'get' | 'post',
    url: string,
    data?: any,
    maxRetries: number = 2
  ): Promise<T> {
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        if (method === 'get') {
          return await this.get<T>(url);
        } else {
          return await this.post<T>(url, data);
        }
      } catch (error) {
        console.error(`API 호출 실패 (시도 ${retries + 1}/${maxRetries + 1}):`, error);
        
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
   * 서버 상태 확인
   * @param url 상태 확인할 URL (기본값: '/')
   */
  public async checkServerStatus(url: string = '/'): Promise<boolean> {
    try {
      console.log('서버 상태 확인 중...');
      const response = await axios.get(this.client.defaults.baseURL + url, {
        timeout: 10000,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('서버 상태 응답:', {
        status: response.status,
        data: response.data
      });
      
      return response.status === 200;
    } catch (error: any) {
      console.error('서버 연결 확인 실패:', error);
      
      if (error.code === 'ECONNABORTED') {
        console.error('서버 연결 타임아웃 발생');
      }
      
      return false;
    }
  }
}

// API 기본 URL
export const API_BASE_URL = '/api';

// 전역 API 클라이언트 인스턴스
export const apiClient = new ApiClient(API_BASE_URL); 