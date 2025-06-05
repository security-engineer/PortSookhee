import React from 'react';
import { ScanMode } from '../../types/scan';

interface ScanOptionsProps {
  scanType: ScanMode;
  ports: string;
  customArguments: string;
  options: {
    osDetection: boolean;
    serviceVersion: boolean;
    scriptScan: boolean;
  };
  onPortsChange: (value: string) => void;
  onCustomArgsChange: (value: string) => void;
  onOptionChange: (option: 'osDetection' | 'serviceVersion' | 'scriptScan') => void;
}

/**
 * 스캔 옵션 컴포넌트 (커스텀 스캔을 위한 추가 옵션)
 */
const ScanOptions: React.FC<ScanOptionsProps> = ({ 
  scanType,
  ports,
  customArguments,
  options,
  onPortsChange,
  onCustomArgsChange,
  onOptionChange
}) => {
  if (scanType !== 'custom') {
    return null;
  }

  return (
    <>
      <div className="form-group">
        <label>포트 범위</label>
        <input 
          type="text" 
          className="form-control"
          placeholder="포트 범위 (예: 22,80,443 또는 1-1000)" 
          value={ports}
          onChange={(e) => onPortsChange(e.target.value)}
        />
      </div>
      
      <div className="form-group">
        <label>스캔 옵션</label>
        <div className="scan-options">
          <div 
            className={`scan-option ${options.osDetection ? 'active' : ''}`}
            onClick={() => onOptionChange('osDetection')}
          >
            <input 
              type="checkbox" 
              checked={options.osDetection}
              onChange={() => {}} // 부모 컴포넌트가 상태 변경 처리
            />
            OS 탐지
          </div>
          
          <div 
            className={`scan-option ${options.serviceVersion ? 'active' : ''}`}
            onClick={() => onOptionChange('serviceVersion')}
          >
            <input 
              type="checkbox" 
              checked={options.serviceVersion}
              onChange={() => {}} // 부모 컴포넌트가 상태 변경 처리
            />
            서비스 버전 탐지
          </div>
          
          <div 
            className={`scan-option ${options.scriptScan ? 'active' : ''}`}
            onClick={() => onOptionChange('scriptScan')}
          >
            <input 
              type="checkbox" 
              checked={options.scriptScan}
              onChange={() => {}} // 부모 컴포넌트가 상태 변경 처리
            />
            스크립트 스캔
          </div>
        </div>
      </div>
      
      <div className="form-group">
        <label>추가 nmap 인자 (선택사항)</label>
        <input 
          type="text" 
          className="form-control"
          placeholder="예: -sV -T4 --open" 
          value={customArguments}
          onChange={(e) => onCustomArgsChange(e.target.value)}
        />
      </div>
    </>
  );
};

export default ScanOptions; 