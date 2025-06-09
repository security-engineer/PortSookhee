import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface VpnConfig {
  name: string;
  path: string;
  size: number;
  modified: number;
}

export interface VpnStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'failed';
  config: string | null;
  profile_name?: string;
  connection_info?: {
    local_ip: string;
    gateway: string;
    dns: string[];
    routes?: string[];
  };
  message?: string;
}

export interface VpnResponse {
  status: 'success' | 'error' | 'info';
  message: string;
  [key: string]: any;
}

export class VpnService {
  /**
   * 저장된 VPN 설정 파일 목록 조회
   */
  static async getConfigs(): Promise<VpnConfig[]> {
    try {
      const response = await axios.get(`${API_URL}/vpn/configs`);
      return response.data.configs;
    } catch (error) {
      console.error('VPN 설정 파일 목록 조회 오류:', error);
      throw error;
    }
  }

  /**
   * VPN 설정 파일 업로드
   */
  static async uploadConfig(file: File): Promise<VpnResponse> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/vpn/configs`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('VPN 설정 파일 업로드 오류:', error);
      throw error;
    }
  }

  /**
   * VPN 설정 파일 삭제
   */
  static async deleteConfig(configName: string): Promise<VpnResponse> {
    try {
      const response = await axios.delete(`${API_URL}/vpn/configs/${configName}`);
      return response.data;
    } catch (error) {
      console.error('VPN 설정 파일 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * VPN 연결 시작
   */
  static async connect(configName: string): Promise<VpnResponse> {
    try {
      const response = await axios.post(`${API_URL}/vpn/connect`, {
        config_name: configName
      });
      return response.data;
    } catch (error) {
      console.error('VPN 연결 오류:', error);
      throw error;
    }
  }

  /**
   * VPN 연결 종료
   */
  static async disconnect(): Promise<VpnResponse> {
    try {
      const response = await axios.post(`${API_URL}/vpn/disconnect`);
      return response.data;
    } catch (error) {
      console.error('VPN 연결 종료 오류:', error);
      throw error;
    }
  }

  /**
   * VPN 연결 상태 조회
   */
  static async getStatus(): Promise<VpnStatus> {
    try {
      const response = await axios.get(`${API_URL}/vpn/status`);
      return response.data;
    } catch (error) {
      console.error('VPN 상태 조회 오류:', error);
      throw error;
    }
  }
} 