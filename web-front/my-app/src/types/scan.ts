/**
 * 스캔 관련 타입 정의
 */

// 스캔 모드 타입
export type ScanMode = 'quick' | 'full' | 'custom' | 'test';

// 스캔 상태 타입
export type ScanStatusType = 'pending' | 'running' | 'completed' | 'failed';

// 포트 정보 타입
export interface Port {
  port: number;
  protocol: 'tcp' | 'udp';
  state: 'open' | 'closed' | 'filtered';
  service: string;
  product?: string;
  version?: string;
}

// OS 정보 타입
export interface OSInfo {
  name: string;
  accuracy: number;
  version: string;
}

// 스크립트 실행 결과 타입
export interface Script {
  name: string;
  output: string;
}

// 호스트 업타임 정보
export interface Uptime {
  seconds: number;
  lastBoot?: string;
}

// 취약점 정보
export interface Vulnerability {
  severity: 'high' | 'medium' | 'low';
  description: string;
  cve?: string;
}

// 호스트 정보 타입
export interface Host {
  ip: string;
  hostname?: string;
  state: string;
  mac?: string;
  macVendor?: string;
  os?: OSInfo;
  ports: Port[];
  scripts?: Script[];
  uptime?: Uptime;
  distance?: number;
  tcpSequence?: {
    class: string;
    difficulty: string;
  };
  vulnerabilities?: Vulnerability[];
  lastScanTime?: string;
  info?: string;
}

// 스캔 결과 타입
export interface ScanResult {
  hosts: Host[];
}

// 스캔 요청 데이터 타입
export interface ScanData {
  target: string;
  mode: ScanMode;
  ports?: string;
  arguments?: string;
}

// 스캔 상태 응답 타입
export interface ScanStatusResponse {
  scan_id: string;
  target: string;
  mode: string;
  status: ScanStatusType;
  start_time: number;
  end_time?: number;
  duration?: number;
  result?: ScanResult;
  error?: string;
}

// 스캔 상태 UI 상태
export interface ScanState {
  isLoading: boolean;
  error: string;
  scanId: string | null;
  scanStatus: ScanStatusResponse | null;
  target: string;
  scanType: ScanMode;
  ports: string;
  customArguments: string;
  options: {
    osDetection: boolean;
    serviceVersion: boolean;
    scriptScan: boolean;
  };
  serverAvailable: boolean;
}

// 스캔 결과 콜백 타입
export type ScanCompleteCallback = (results: ScanResult) => void; 