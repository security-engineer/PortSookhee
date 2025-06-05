import React from 'react';

interface ServerStatusProps {
  isAvailable: boolean;
  onCheckStatus: () => void;
}

/**
 * 서버 연결 상태를 표시하는 컴포넌트
 */
const ServerStatus: React.FC<ServerStatusProps> = ({ isAvailable, onCheckStatus }) => {
  const serverAddress = 'localhost:5000'; // 백엔드 서버 주소
  
  return (
    <div className={`server-status ${isAvailable ? 'available' : 'unavailable'}`}>
      <div className="server-status-content">
        <div className="server-status-indicator"></div>
        <div className="server-status-text">
          {isAvailable 
            ? <>서버 연결 정상 <span className="server-address">({serverAddress})</span></>
            : <>서버 연결 실패. 백엔드 서버에 접속할 수 없습니다. <span className="server-address">({serverAddress})</span></>
          }
        </div>
      </div>
      
      <button 
        className="refresh-button"
        onClick={onCheckStatus} 
        title="서버 상태를 다시 확인합니다"
      >
        새로고침
      </button>
    </div>
  );
};

export default ServerStatus; 