// src/types/index.ts
// 스크립트 정보 타입
export interface ScriptInfo {
  id: string;
  output: string;
}

// 호스트 포트 정보 타입
export interface PortInfo {
  port: number;
  protocol?: string;
  state: string;
  service: string;
  product: string;
  version: string;
  extrainfo: string;
  vulnerabilities?: Vulnerability[];
  scripts?: ScriptInfo[];
}

// 취약점 정보 타입
export interface Vulnerability {
  cve_id: string;
  cvss_score: number;
  title: string;
  description: string;
  id?: string;
}

// OS 정보 타입
export interface OSInfo {
  name: string;
  accuracy: string;
}

// 호스트 정보 타입
export interface HostInfo {
  host: string;
  state: string;
  os: OSInfo;
  ports: PortInfo[];
}

// 스캔 결과 타입
export interface ScanResult {
  scan_id?: string;
  timestamp?: string;
  target: string;
  hosts: HostInfo[];
  error?: string;
}

// 리포트 요약 정보
export interface ReportSummary {
  hosts_scanned: number;
  vulnerabilities_found: number;
  risk_level: string;
  total_hosts?: number;
  total_vulnerabilities?: number;
  target_ips?: string[];
  scan_date?: string;
}

// 리포트 타입
export interface Report {
  report_id?: string;
  timestamp: string;
  summary: ReportSummary;
  details: ScanResult;
  vuln_results?: ScanResult;
}

// 스캔 메타데이터 타입
export interface ScanMeta {
  id: string;
  filename: string;
  path: string;
  timestamp: string;
  target: string;
}

// 리포트 메타데이터 타입
export interface ReportMeta {
  id: string;
  filename: string;
  path: string;
  timestamp: string;
  summary: ReportSummary;
}

// 앱 상태 타입
export interface AppState {
  scan: {
    loading: boolean;
    error: string | null;
    currentScan: ScanResult | null;
    scans: ScanMeta[];
  };
  vulnerability: {
    loading: boolean;
    error: string | null;
    currentVulnerability: ScanResult | null;
    vulnerabilities: any[];
  };
  report: {
    loading: boolean;
    error: string | null;
    currentReport: Report | null;
    reports: ReportMeta[];
  };
}
