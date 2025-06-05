import React from 'react';
import './ScanForm.css';

import { useScan } from '../../hooks/useScan';
import { ScanResult } from '../../types/scan';
import { NodeData } from '../topology/Topology';

import ServerStatus from './ServerStatus';
import ScanTypeSelector from './ScanTypeSelector';
import ScanOptions from './ScanOptions';
import ScanStatus from './ScanStatus';
import ScanResults from './ScanResults';

interface ScanFormProps {
  onScanComplete?: (results: ScanResult) => void;
  onNodeSelect?: (node: NodeData | null) => void;
}

/**
 * 스캔 폼 컴포넌트
 */
const ScanForm: React.FC<ScanFormProps> = ({ onScanComplete, onNodeSelect }) => {
  // 커스텀 훅으로 스캔 상태 및 로직 관리
  const {
    target, setTarget,
    scanType, setScanType,
    ports, setPorts,
    customArguments, setCustomArguments,
    options, handleOptionChange,
    isLoading, error, scanId, scanStatus, serverAvailable,
    handleSubmit, resetScan, checkServerStatus
  } = useScan({
    onScanComplete,
    onNodeSelect
  });
  
  return (
    <div className="scan-container">
      {/* 서버 상태 */}
      <ServerStatus 
        isAvailable={serverAvailable} 
        onCheckStatus={checkServerStatus} 
      />
      
      {/* 스캔 상태가 있으면 표시 */}
      {scanStatus ? (
        <>
          <ScanStatus 
            scanStatus={scanStatus} 
            onReset={resetScan} 
          />
          
          {/* 스캔 결과 추가 - 완료된 경우에만 표시 */}
          {scanStatus.status === 'completed' && (
            <div className="scan-results-container">
              <h3>스캔 결과</h3>
              {scanStatus.result ? (
                <>
                  {/* 디버그 정보 (개발 중에만 표시) */}
                  {process.env.NODE_ENV === 'development' && (
                    <details className="debug-info">
                      <summary>디버그 정보</summary>
                      <div className="debug-data">
                        <p><strong>스캔 ID:</strong> {scanStatus.scan_id}</p>
                        <p><strong>대상:</strong> {scanStatus.target}</p>
                        <p><strong>호스트 수:</strong> {scanStatus.result.hosts?.length || 0}</p>
                        {scanStatus.result.hosts?.length > 0 && (
                          <p><strong>첫 호스트 IP:</strong> {scanStatus.result.hosts[0].ip}</p>
                        )}
                      </div>
                    </details>
                  )}
                  <ScanResults results={scanStatus.result} />
                </>
              ) : (
                <div className="empty-result-message">
                  <div className="empty-icon">❗</div>
                  <div className="empty-text">
                    결과 데이터를 불러올 수 없습니다. 서버 응답 형식이 예상과 다릅니다.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* 스캔 폼 */
        <form className="scan-form" onSubmit={handleSubmit}>
          <h2>네트워크 스캔</h2>
          
          {/* 대상 입력 */}
          <div className="form-group">
            <label>스캔 대상</label>
            <input 
              type="text" 
              className="form-control"
              placeholder="IP 주소 또는 도메인 (예: 192.168.1.1 또는 example.com)" 
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          {/* 스캔 유형 선택 */}
          <ScanTypeSelector 
            scanType={scanType} 
            onChange={setScanType} 
          />
          
          {/* 스캔 옵션 (커스텀 스캔일 때만 표시) */}
          <ScanOptions
            scanType={scanType}
            ports={ports}
            customArguments={customArguments}
            options={options}
            onPortsChange={setPorts}
            onCustomArgsChange={setCustomArguments}
            onOptionChange={handleOptionChange}
          />
          
          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          {/* 제출 버튼 */}
          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading || !serverAvailable}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner"></div>
                스캔 중...
              </>
            ) : '스캔 시작'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ScanForm; 