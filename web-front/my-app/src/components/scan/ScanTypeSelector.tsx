import React from 'react';
import { ScanMode } from '../../types/scan';

interface ScanTypeSelectorProps {
  scanType: ScanMode;
  onChange: (type: ScanMode) => void;
}

/**
 * 스캔 유형 선택 컴포넌트
 */
const ScanTypeSelector: React.FC<ScanTypeSelectorProps> = ({ scanType, onChange }) => {
  return (
    <div className="form-group">
      <label>스캔 유형</label>
      <div className="scan-type-options">
        <div 
          className={`scan-type-option ${scanType === 'quick' ? 'active' : ''}`}
          onClick={() => onChange('quick')}
        >
          빠른 스캔
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
            인기 포트만 빠르게 확인
          </div>
        </div>
        
        <div 
          className={`scan-type-option ${scanType === 'full' ? 'active' : ''}`}
          onClick={() => onChange('full')}
        >
          전체 스캔
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
            모든 포트와 서비스 상세 분석
          </div>
        </div>
        
        <div 
          className={`scan-type-option ${scanType === 'custom' ? 'active' : ''}`}
          onClick={() => onChange('custom')}
        >
          사용자 정의
          <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
            스캔 범위와 옵션 직접 설정
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanTypeSelector; 