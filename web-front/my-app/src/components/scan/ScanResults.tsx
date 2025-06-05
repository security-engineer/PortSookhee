import React, { useState, useMemo } from 'react';
import { ScanResult, Host, Vulnerability, Port } from '../../types/scan';
import { detectVulnerabilities } from '../../utils/scanDataNormalizer';
import './ScanResults.css';

interface ScanResultsProps {
  results: ScanResult;
}

/**
 * 스캔 결과 표시 컴포넌트
 */
const ScanResults: React.FC<ScanResultsProps> = ({ results }) => {
  // results 객체 검사
  if (!results) {
    console.error('ScanResults: results가 undefined입니다');
    return (
      <div className="scan-results error-state">
        <div className="error-message">
          결과 데이터가 없습니다. 서버 응답 오류가 발생했을 수 있습니다.
        </div>
      </div>
    );
  }
  
  console.log('ScanResults 렌더링:', results);
  const hosts = results.hosts || [];
  console.log(`호스트 ${hosts.length}개 표시`);
  
  // 스캔된 호스트가 없는 경우
  if (hosts.length === 0) {
    return (
      <div className="scan-results no-results">
        <h3>스캔 결과</h3>
        <div className="no-hosts-message">
          <div className="no-host-icon">🔎</div>
          <div className="no-host-text">
            <p>발견된 호스트가 없습니다.</p>
            <p className="help-text">다음과 같은 이유가 있을 수 있습니다:</p>
            <ul>
              <li>대상 IP가 네트워크에 존재하지 않음</li>
              <li>방화벽이 스캔 요청 차단</li>
              <li>호스트가 응답하지 않음 (꺼져있거나 포트가 닫힘)</li>
              <li>VPN 연결이 끊어져 있습니다. OpenVPN 연결 상태를 확인하세요.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="scan-results">
      <h3>스캔 결과 <span className="host-count">{hosts.length}개 호스트 발견</span></h3>
      
      <div className="hosts-list">
        {hosts.map(host => (
          <HostCard key={host.ip} host={host} />
        ))}
      </div>
    </div>
  );
};

/**
 * 호스트 카드 컴포넌트
 */
interface HostCardProps {
  host: Host;
}

const HostCard: React.FC<HostCardProps> = ({ host }) => {
  // 호스트의 취약점이 정의되어 있지 않으면 자동 계산
  const vulnerabilities = useMemo(() => {
    return host.vulnerabilities || detectVulnerabilities(host);
  }, [host]);
  
  // 취약점 심각도별 개수 계산
  const vulnerabilityCounts = useMemo(() => {
    return vulnerabilities.reduce(
      (counts, vuln) => {
        counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>
    );
  }, [vulnerabilities]);
  
  // 취약점 존재 여부
  const hasVulnerabilities = vulnerabilities.length > 0;
  
  // 열린 포트 필터링
  const openPorts = useMemo(() => {
    return (host.ports || []).filter(port => port.state === 'open');
  }, [host.ports]);
  
  return (
    <div className="host-card">
      <div className="host-header">
        <div className="host-title">
          <h4>{host.hostname || host.ip}</h4>
          <div className="host-ip">IP: {host.ip}</div>
        </div>
        {host.os && (
          <div className="os-info">
            <span className="os-label">OS:</span> {host.os.name} 
            {host.os.accuracy && <span className="os-accuracy">({host.os.accuracy}% 정확도)</span>}
          </div>
        )}
      </div>
      
      <div className="host-body">
        {/* 호스트 추가 정보가 있는 경우 표시 */}
        {host.info && (
          <div className="host-info-message">
            <div className="info-icon">ℹ️</div>
            <div className="info-text">{host.info}</div>
          </div>
        )}
        
        {/* 열린 포트 정보 */}
        <div className="ports-section">
          <h5>열린 포트 ({openPorts.length})</h5>
          {openPorts.length > 0 ? (
            <PortsTable ports={openPorts} />
          ) : (
            <div className="no-ports-message">열린 포트가 없습니다.</div>
          )}
        </div>
        
        {/* 취약점 정보 */}
        {hasVulnerabilities && (
          <div className="vulnerabilities-section">
            <h5>
              탐지된 취약점 ({vulnerabilities.length})
              
              {/* 취약점 요약 뱃지 */}
              <div className="vulnerability-badges">
                {vulnerabilityCounts.high && (
                  <span className="vuln-badge high">높음: {vulnerabilityCounts.high}</span>
                )}
                {vulnerabilityCounts.medium && (
                  <span className="vuln-badge medium">중간: {vulnerabilityCounts.medium}</span>
                )}
                {vulnerabilityCounts.low && (
                  <span className="vuln-badge low">낮음: {vulnerabilityCounts.low}</span>
                )}
              </div>
            </h5>
            
            <VulnerabilitiesList vulnerabilities={vulnerabilities} />
          </div>
        )}
      </div>
      
      {/* 호스트 정보 기타 */}
      <div className="host-footer">
        {host.mac && (
          <div className="host-detail">
            <span className="detail-label">MAC:</span> {host.mac} 
            {host.macVendor && <span className="mac-vendor">({host.macVendor})</span>}
          </div>
        )}
        
        {host.uptime && (
          <div className="host-detail">
            <span className="detail-label">가동 시간:</span> 
            {formatUptime(host.uptime.seconds)}
            {host.uptime.lastBoot && (
              <span className="last-boot"> (최근 부팅: {new Date(host.uptime.lastBoot).toLocaleString()})</span>
            )}
          </div>
        )}
        
        {host.lastScanTime && (
          <div className="host-detail scan-time">
            <span className="detail-label">스캔 시간:</span> 
            {new Date(host.lastScanTime).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 포트 테이블 컴포넌트
 */
interface PortsTableProps {
  ports: Port[];
}

const PortsTable: React.FC<PortsTableProps> = ({ ports }) => {
  return (
    <div className="ports-table-wrapper">
      <table className="ports-table">
        <thead>
          <tr>
            <th>포트</th>
            <th>프로토콜</th>
            <th>서비스</th>
            <th>버전</th>
          </tr>
        </thead>
        <tbody>
          {ports.map(port => (
            <tr key={`${port.protocol}-${port.port}`}>
              <td>{port.port}</td>
              <td>{port.protocol}</td>
              <td>{port.service}</td>
              <td>
                {port.product ? `${port.product} ${port.version || ''}` : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 취약점 목록 컴포넌트
 */
interface VulnerabilitiesListProps {
  vulnerabilities: Vulnerability[];
}

const VulnerabilitiesList: React.FC<VulnerabilitiesListProps> = ({ vulnerabilities }) => {
  return (
    <div className="vulnerabilities-list">
      {vulnerabilities.map((vuln, index) => (
        <div 
          key={index} 
          className={`vulnerability-item ${vuln.severity}`}
        >
          <div className="vulnerability-severity">{getSeverityLabel(vuln.severity)}</div>
          <div className="vulnerability-description">{vuln.description}</div>
          {vuln.cve && (
            <div className="vulnerability-cve">
              <a 
                href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.cve}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {vuln.cve}
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

/**
 * 가동 시간을 읽기 쉬운 형식으로 변환
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}일 ${hours}시간 ${minutes}분`;
  }
  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}분`;
}

/**
 * 취약점 심각도 라벨
 */
function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'high': return '높음';
    case 'medium': return '중간';
    case 'low': return '낮음';
    default: return severity;
  }
}

export default ScanResults; 