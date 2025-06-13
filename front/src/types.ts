//
// 이 파일은 PortSookhee 프로젝트 전체에서 사용되는 핵심 TypeScript 타입을 정의합니다.
//

// =================================================================
// 스캔 및 취약점 관련 기본 타입
// =================================================================

/** CVE, CVSS 점수 등 단일 취약점에 대한 상세 정보 */
export interface Vulnerability {
  id: string;
  cve: string;
  type: string;
  cvss_score: number;
  cvss_version: string;
  summary: string;
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  [key: string]: any; // 기타 추가 필드를 위한 인덱스 시그니처
}

/** Nmap 스크립트 실행 결과 */
export interface ScriptInfo {
  id: string;
  output: string;
}

/** 단일 포트에 대한 정보 (서비스, 상태, 취약점 등) */
export interface PortInfo {
  port_id: number;
  protocol: string;
  state: string;
  service: string;
  version?: string;
  scripts?: ScriptInfo[];
  vulnerabilities?: Vulnerability[];
}

/** 단일 호스트(IP)에 대한 정보 (OS, 포트 목록 등) */
export interface HostInfo {
  host: string;
  state: 'up' | 'down';
  os?: {
    name?: string;
  };
  ports: PortInfo[];
}


// =================================================================
// API 응답 및 데이터 구조 관련 타입
// =================================================================

/** 전체 스캔 결과 데이터 구조 */
export interface ScanResult {
  scan_id: string;
  timestamp: string;
  target: string;
  arguments: string;
  hosts: HostInfo[];
}

/** 스캔 목록에 표시될 간략한 메타 정보 */
export interface ScanMeta {
  scan_id: string;
  target: string;
  timestamp: string;
  status: string;
  host_count: number;
}


// =================================================================
// 리포트 관련 타입
// =================================================================

/** 리포트의 상세 내용을 담는 객체 */
export interface ReportDetails {
  scan_id: string;
  target: string;
  hosts: HostInfo[];
  vulnerabilities?: Vulnerability[]; // 모든 호스트의 취약점을 종합한 목록
}

/** 리포트의 요약 정보를 담는 객체 */
export interface ReportSummary {
    hosts_scanned: number;
    vulnerabilities_found: number;
    risk_level: 'Low' | 'Medium' | 'High' | 'Critical' | 'None';
    target_ips: string[];
}

/** 전체 리포트 데이터 구조 */
export interface Report {
  report_id: string;
  profile_id?: string; // 리포트가 속한 프로필 ID
  user_id: string;
  scan_id: string;
  timestamp: string;
  details: ReportDetails; // 상세 스캔 및 분석 결과
  summary: ReportSummary; // 요약 정보
  vuln_results?: any; // 하위 호환성을 위한 이전 필드
}

/** 리포트 목록에 표시될 간략한 메타 정보 */
export interface ReportMeta {
  id: string; // report_id에 해당
  target: string;
  timestamp: string;
  filename: string;
  path: string;
  summary: ReportSummary;
}


// =================================================================
// 네트워크 토폴로지 관련 타입
// =================================================================

/** 토폴로지 맵의 단일 노드를 나타내는 타입 */
export interface TopologyNode {
  id: string;
  label: string;
  type: 'host' | 'router' | 'switch' | 'unknown';
  state?: 'up' | 'down';
  ip_address?: string;
  report_id?: string;
  scan_id?: string;
  timestamp?: string;
  target?: string;
  risk_level?: string;
  vulnerabilities_count?: number;
  high_risk_count?: number;
  description?: string;
  custom_data?: {
    role: 'central' | 'node' | 'peripheral';
    os?: string;
    ports?: number;
    open_ports?: number;
    vulnCount?: number;
    highRiskCount?: number;
    services?: string[];
    host?: any;
    vulnerabilities_summary?: any;
    [key: string]: any;
  };
}

/** 토폴로지 맵의 엣지(연결선)를 나타내는 타입 */
export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

/** 사용자 프로필별 전체 토폴로지 데이터 구조 */
export interface UserTopology {
  user_id: string;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  created_at: string;
  updated_at: string;
} 