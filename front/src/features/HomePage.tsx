import React, { Suspense, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { addProfile, setActiveProfile } from '../store/slices/profileSlice';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
// NetworkTopology를 React.lazy로 지연 로딩
const NetworkTopology = React.lazy(() => import('./NetworkTopology'));

const ProfileManager: React.FC = () => {
  const dispatch: AppDispatch = useDispatch();
  const { profiles, activeProfileId } = useSelector((state: RootState) => state.profile);
  const [newProfileName, setNewProfileName] = useState('');

  const handleAddProfile = useCallback(() => {
    if (newProfileName.trim() === '') return;
    const newProfile = {
      id: `profile_${Date.now()}`,
      name: newProfileName.trim(),
    };
    dispatch(addProfile(newProfile));
    dispatch(setActiveProfile(newProfile.id));
    setNewProfileName('');
  }, [dispatch, newProfileName]);

  const handleProfileChange = (profileId: string) => {
    dispatch(setActiveProfile(profileId));
  };
  
  if (!activeProfileId) return <div>프로필을 로드하는 중...</div>;

  return (
    <div className="bg-gray-100 dark:bg-gray-900/50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[200px]">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">현재 프로필</Label>
        <Select value={activeProfileId} onValueChange={handleProfileChange}>
          <SelectTrigger>
            <SelectValue placeholder="프로필 선택" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="new-profile" className="text-sm font-medium text-gray-700 dark:text-gray-300">새 프로필 생성</Label>
        <div className="flex items-center gap-2">
          <Input 
            id="new-profile"
            type="text" 
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="새 프로필 이름"
          />
          <Button onClick={handleAddProfile}>추가</Button>
        </div>
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  const [showTopology, setShowTopology] = useState<boolean>(true);
  const { currentReport } = useSelector((state: RootState) => state.report);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  // 컴포넌트가 마운트된 후 일정 시간 후에 토폴로지 로드
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTopology(true);
    }, 300);

    return () => clearTimeout(timer);
  }, []);
  
  // 새 리포트가 생성되면 토폴로지 표시 확인
  useEffect(() => {
    if (currentReport && currentReport.report_id && lastReportId !== currentReport.report_id) {
      setLastReportId(currentReport.report_id || null);
      setShowTopology(true);
    }
  }, [currentReport, lastReportId]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">
          PortSookhee - 네트워크 취약점 분석 시스템
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          이 시스템은 네트워크 환경의 보안 취약점을 탐지하고 분석하여 보안 위협을 사전에 방지하는 데 도움을 줍니다.
          프로필 기반으로 스캔 환경을 분리하여 관리하고, VPN 연결을 통한 안전한 스캔과 분석 결과 리포트 생성까지 원스톱으로 제공합니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-blue-700 dark:text-blue-300">스캔</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              대상 네트워크나 호스트를 스캔하여 열린 포트와 실행 중인 서비스를 식별합니다.
            </p>
            <Link to="/scan" className="inline-block px-4 py-2 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 transition-colors">
              스캔 시작
            </Link>
          </div>

          <div className="bg-green-50 dark:bg-green-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-green-700 dark:text-green-300">기록</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              이전에 실행한 스캔 결과를 확인하고 시간에 따른 보안 상태 변화를 모니터링합니다.
            </p>
            <Link to="/history" className="inline-block px-4 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 transition-colors">
              기록 보기
            </Link>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-purple-700 dark:text-purple-300">VPN 관리</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              안전한 스캔을 위한 VPN 연결을 설정하고 관리합니다.
            </p>
            <Link to="/vpn" className="inline-block px-4 py-2 bg-purple-500 text-white font-medium rounded hover:bg-purple-600 transition-colors">
              VPN 설정
            </Link>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">시작하는 방법</h2>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>VPN 관리 페이지에서 안전한 스캔을 위한 VPN 연결을 설정합니다.</li>
            <li>스캔 페이지에서 대상 네트워크 또는 호스트와 스캔 옵션을 지정합니다.</li>
            <li>스캔 결과를 분석하고 취약점을 확인합니다.</li>
            <li>보안 조치를 취하고 기록 페이지에서 이전 스캔과 비교합니다.</li>
          </ol>
        </div>
      </div>
      

      {/* 통합된 네트워크 토폴로지 컴포넌트 */}
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">네트워크 토폴로지</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          선택된 프로필의 스캔 결과와 리포트를 기반으로 구성된 네트워크 구조를 시각화합니다. 
          각 노드를 클릭하면 상세 정보를 확인할 수 있습니다.
        </p>
      </div>

      {showTopology ? (
        <Suspense fallback={
          <div className="w-full h-[400px] flex items-center justify-center border rounded bg-gray-50 dark:bg-gray-800">
            <p className="text-gray-500 dark:text-gray-400">네트워크 토폴로지를 불러오는 중입니다...</p>
          </div>
        }>
          <NetworkTopology 
            showAddReportButton={true} 
            simpleMode={false}
          />
        </Suspense>
      ) : (
        <div className="w-full h-[100px] flex items-center justify-center border rounded bg-gray-50 dark:bg-gray-800">
           <Button onClick={() => setShowTopology(true)}>토폴로지 표시하기</Button>
        </div>
      )}
    </div>
  );
};

export default HomePage; 