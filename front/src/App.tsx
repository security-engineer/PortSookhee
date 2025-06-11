import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import './App.css';

// 페이지 컴포넌트들
import ScanForm from './features/ScanForm';
import ScanResults from './features/ScanResults';
import VulnerabilityResults from './features/VulnerabilityResults';
import ScanHistory from './features/ScanHistory';
import VpnManager from './features/VpnManager';
import ReportDetail from './features/ReportDetail';
import ProfileManager from './features/ProfileManager';
import ProfileManagerTest from './features/ProfileManagerTest';
import BasicTest from './features/BasicTest';
import ProfileSelector from './components/ProfileSelector';
import HomePage from './features/HomePage';

// 라우트 로깅을 위한 래퍼 컴포넌트
const RouteLogger = () => {
  const location = useLocation();
  
  useEffect(() => {
    console.log('현재 경로:', location.pathname);
  }, [location]);
  
  return null;
};

const App: React.FC = () => {
  useEffect(() => {
    console.log('App 컴포넌트 마운트됨');
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <RouteLogger />
        <nav className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex-shrink-0">
                <span className="text-xl font-bold">PortSookhee</span>
              </div>
              
              {/* 중앙 배치 네비게이션 */}
              <div className="flex-grow flex justify-center">
                <div className="flex space-x-8">
                  <Link to="/" className="px-3 py-2 hover:text-blue-500 font-medium">
                    Dashboard
                  </Link>
                  <Link to="/scan" className="px-3 py-2 hover:text-blue-500 font-medium">
                    Scan
                  </Link>
                  <Link to="/history" className="px-3 py-2 hover:text-blue-500 font-medium">
                    History & Report
                  </Link>
                  <Link to="/vpn" className="px-3 py-2 hover:text-blue-500 font-medium">
                    VPN Manage
                  </Link>
                </div>
              </div>
              
              {/* 오른쪽 프로파일 선택기 */}
              <div>
                <ProfileSelector />
              </div>
            </div>
          </div>
        </nav>

        <main className="container mx-auto py-6">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/scan" element={<ScanForm />} />
            <Route path="/results/:scanId" element={<ScanResults />} />
            <Route path="/results/latest" element={<ScanResults />} />
            <Route path="/reports/:reportId" element={<ReportDetail />} />
            <Route path="/vulnerabilities/:scanId" element={<VulnerabilityResults />} />
            <Route path="/vulnerabilities/latest" element={<VulnerabilityResults />} />
            <Route path="/history" element={<ScanHistory />} />
            <Route path="/vpn" element={<VpnManager />} />
            
            {/* 테스트 라우트 - 개발 완료 후 주석 처리 또는 제거 가능 */}
            <Route path="/profiles/test" element={<ProfileManagerTest />} />
            <Route path="/basic-test" element={<BasicTest />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
