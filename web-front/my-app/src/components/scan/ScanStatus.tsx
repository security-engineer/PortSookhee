import React from 'react';
import { ScanStatusResponse } from '../../types/scan';
import { getStatusLabel, getScanTypeLabel } from '../../utils/scanDataNormalizer';

interface ScanStatusProps {
  scanStatus: ScanStatusResponse;
  onReset: () => void;
}

/**
 * 스캔 상태 표시 컴포넌트
 */
const ScanStatus: React.FC<ScanStatusProps> = ({ scanStatus, onReset }) => {
  if (!scanStatus) return null;
  
  const { status, target, mode, start_time, end_time, result } = scanStatus;
  
  // 스캔 결과 확인
  const hasResult = result && result.hosts && result.hosts.length > 0;
  const hostCount = result?.hosts?.length || 0;
  
  // 시작 시간 및 실행 시간 계산
  const startTime = new Date(start_time * 1000).toLocaleString();
  let duration = '진행 중...';
  
  if (end_time && end_time > start_time) {
    const durationSeconds = Math.round(end_time - start_time);
    if (durationSeconds < 60) {
      duration = `${durationSeconds}초`;
    } else {
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      duration = `${minutes}분 ${seconds}초`;
    }
  }
  
  return (
    <div className="scan-status">
      <div className="scan-status-header">
        <h3 style={{ margin: 0 }}>스캔 상태</h3>
        <span className={`scan-status-badge ${status}`}>
          {status === 'running' && <div className="loading-spinner"></div>}
          {getStatusLabel(status)}
          {status === 'completed' && ` (${hostCount}개 호스트 발견)`}
        </span>
      </div>
      
      <div className="scan-details">
        <div className="scan-detail-item">
          <div className="scan-detail-label">대상:</div>
          <div className="scan-detail-value">{target}</div>
        </div>
        
        <div className="scan-detail-item">
          <div className="scan-detail-label">유형:</div>
          <div className="scan-detail-value">{getScanTypeLabel(mode)}</div>
        </div>
        
        <div className="scan-detail-item">
          <div className="scan-detail-label">시작 시간:</div>
          <div className="scan-detail-value">{startTime}</div>
        </div>
        
        <div className="scan-detail-item">
          <div className="scan-detail-label">소요 시간:</div>
          <div className="scan-detail-value">{duration}</div>
        </div>
      </div>
      
      {/* 결과 요약 */}
      {status === 'completed' && (
        <div className="scan-summary">
          {hasResult ? (
            <div className="scan-result-summary">
              <div className="summary-icon success">✓</div>
              <div className="summary-text">
                스캔이 성공적으로 완료되었습니다. {hostCount}개의 호스트가 발견되었습니다.
              </div>
            </div>
          ) : (
            <div className="scan-result-summary">
              <div className="summary-icon warning">!</div>
              <div className="summary-text">
                스캔은 완료되었으나 발견된 호스트가 없습니다. 
                대상이 활성화되어 있는지, 방화벽이 차단하고 있는지 확인하세요.
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 디버그 정보 - 개발 중에만 표시 */}
      {process.env.NODE_ENV === 'development' && status === 'completed' && (
        <div className="debug-info">
          <details>
            <summary>디버그 정보</summary>
            <div className="debug-content">
              <div><strong>스캔 ID:</strong> {scanStatus.scan_id}</div>
              <div><strong>결과 존재:</strong> {hasResult ? '예' : '아니오'}</div>
              <div><strong>호스트 수:</strong> {hostCount}</div>
            </div>
          </details>
        </div>
      )}
      
      {['completed', 'failed'].includes(status) && (
        <button className="back-button" onClick={onReset}>
          새 스캔 시작
        </button>
      )}
      
      {status === 'failed' && scanStatus.error && (
        <div className="error-message" style={{ marginTop: '15px' }}>
          <strong>오류 발생:</strong> {scanStatus.error}
        </div>
      )}
    </div>
  );
};

export default ScanStatus; 