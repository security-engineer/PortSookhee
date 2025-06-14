import React, { useState, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { UserCircle, PlusCircle, Check, ChevronDown, Trash2 } from 'lucide-react';
import apiService from '../services/api';
import { resetTopologyState } from '../store/slices/topologySlice';
import { useAppDispatch } from '../store/hooks';

const ProfileSelector: React.FC = () => {
  const [profiles, setProfiles] = useState<string[]>(['default']);
  const [currentProfile, setCurrentProfile] = useState<string>('default');
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [isAddingProfile, setIsAddingProfile] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useAppDispatch();

  // 프로필 목록 로드
  const loadProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getProfiles();
      if (response.status === 200) {
        setProfiles(response.data.profiles || ['default']);
        setCurrentProfile(response.data.current_profile || 'default');
      } else {
        console.error('프로필 로드 실패:', response.data);
      }
    } catch (error) {
      console.error('프로필 API 오류:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 프로필 변경
  const handleSelectProfile = async (profileName: string) => {
    if (profileName === currentProfile) {
      setIsDropdownOpen(false);
      return;
    }

    // 상태 초기화
    dispatch(resetTopologyState());
    
    setIsLoading(true);
    try {
      console.log(`프로필 변경 시도: ${profileName}`);
      const response = await apiService.setCurrentProfile(profileName);
      console.log(`프로필 변경 응답:`, response);
      
      if (response.status === 200) {
        setCurrentProfile(profileName);
        setIsDropdownOpen(false);
        console.log('프로필 변경 성공, 페이지 새로고침');
        
        // 페이지 새로고침 (선택적)
        window.location.reload();
      } else {
        console.error('프로필 변경 실패:', response.data.error);
        setError(response.data.error || '프로필 변경에 실패했습니다.');
        setTimeout(() => setError(null), 3000);
        
        // 프로필 목록 다시 로드
        loadProfiles();
      }
    } catch (error: any) {
      console.error('프로필 변경 오류:', error);
      setError('프로필 변경 중 오류가 발생했습니다.');
      setTimeout(() => setError(null), 3000);
      
      // 프로필 목록 다시 로드
      loadProfiles();
    } finally {
      setIsLoading(false);
    }
  };

  // 프로필 삭제
  const handleDeleteProfile = async (profileName: string) => {
    if (profileName === 'default' || profileName === currentProfile) return;

    if (window.confirm(`'${profileName}' 프로필을 정말로 삭제하시겠습니까?`)) {
      setIsLoading(true);
      try {
        const response = await apiService.deleteProfile(profileName);
        if (response.status === 200) {
          console.log('프로필 삭제 성공');
          loadProfiles(); // 목록 새로고침
        } else {
          setError(response.data.error || '프로필 삭제에 실패했습니다.');
          setTimeout(() => setError(null), 3000);
        }
      } catch (error) {
        setError('프로필 삭제 중 오류가 발생했습니다.');
        setTimeout(() => setError(null), 3000);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // 새 프로필 생성
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    setIsLoading(true);
    try {
      const response = await apiService.createProfile(newProfileName);
      if (response.status === 200) {
        setNewProfileName('');
        setIsAddingProfile(false);
        loadProfiles();
      } else {
        setError(response.data.error || '프로필 생성에 실패했습니다.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      setError('프로필 생성 중 오류가 발생했습니다.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setIsAddingProfile(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 초기 로드
  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 선택기 버튼 */}
      <button
        className="flex items-center space-x-1 px-3 py-2 rounded border border-gray-200 
                  hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        disabled={isLoading}
      >
        <UserCircle className="h-4 w-4" />
        <span className="text-sm font-medium">{currentProfile}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {/* 드롭다운 메뉴 */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-10">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-500 border-b">프로필 선택</div>

            {/* 프로필 목록 */}
            <div className="max-h-48 overflow-y-auto">
              {profiles.map((profile) => (
                <div key={profile} className="flex items-center justify-between hover:bg-gray-100 group">
                  <button
                    className="w-full text-left px-4 py-2 text-sm flex items-center space-x-2"
                    onClick={() => handleSelectProfile(profile)}
                    disabled={isLoading}
                  >
                    {profile === currentProfile && <Check className="h-4 w-4 text-green-500" />}
                    <span className={profile === currentProfile ? "font-medium" : ""}>
                      {profile}
                    </span>
                  </button>
                  {profile !== 'default' && profile !== currentProfile && (
                    <button
                      onClick={() => handleDeleteProfile(profile)}
                      className="p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`${profile} 삭제`}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 새 프로필 추가 UI */}
            {isAddingProfile ? (
              <div className="p-2 border-t">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                  placeholder="새 프로필 이름"
                  autoFocus
                />
                <div className="flex justify-end mt-2 space-x-2">
                  <button
                    className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded"
                    onClick={() => setIsAddingProfile(false)}
                  >
                    취소
                  </button>
                  <button
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded disabled:bg-blue-300"
                    onClick={handleCreateProfile}
                    disabled={!newProfileName.trim() || isLoading}
                  >
                    추가
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="w-full text-left px-4 py-2 text-sm text-blue-500 hover:bg-gray-100 flex items-center space-x-2 border-t"
                onClick={() => setIsAddingProfile(true)}
              >
                <PlusCircle className="h-4 w-4" />
                <span>새 프로필 추가</span>
              </button>
            )}
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="px-4 py-2 text-xs text-white bg-red-500 rounded-b-lg">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileSelector; 