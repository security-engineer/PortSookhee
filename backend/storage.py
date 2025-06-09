import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid

class LocalStorage:
    def __init__(self, data_dir: str = "data"):
        """
        로컬 파일 시스템을 사용하여 데이터 관리
        
        Args:
            data_dir: 데이터 저장 디렉토리 경로
        """
        self.data_dir = data_dir
        self._ensure_data_dir_exists()
        # 현재 프로필 상태 파일 경로
        self.profile_state_file = os.path.join(self.data_dir, "profile_state.json")
        # 기본 프로필 설정
        if not os.path.exists(self.profile_state_file):
            self._save_profile_state({"current_profile": "default"})
    
    def _ensure_data_dir_exists(self):
        """데이터 디렉토리 존재 여부 확인 및 생성"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
            
        # 각 데이터 타입별 디렉토리 생성
        for subdir in ["scans", "reports", "profiles"]:
            subdir_path = os.path.join(self.data_dir, subdir)
            if not os.path.exists(subdir_path):
                os.makedirs(subdir_path)
                
        # 기본 프로필 디렉토리 생성
        default_profile_dir = os.path.join(self.data_dir, "profiles", "default")
        if not os.path.exists(default_profile_dir):
            os.makedirs(default_profile_dir)
            # 기본 프로필의 하위 디렉토리 생성
            for subdir in ["scans", "reports"]:
                os.makedirs(os.path.join(default_profile_dir, subdir), exist_ok=True)
    
    def _generate_filename(self, prefix: str) -> str:
        """
        고유한 파일 이름 생성
        
        Args:
            prefix: 파일 이름 접두사
            
        Returns:
            고유 파일 이름
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]  # UUID의 짧은 버전
        return f"{prefix}_{timestamp}_{unique_id}.json"
    
    # 프로필 관련 메서드
    def get_profiles(self) -> List[str]:
        """
        사용 가능한 프로필 목록 반환
        
        Returns:
            프로필 이름 목록
        """
        profiles_dir = os.path.join(self.data_dir, "profiles")
        print(f"프로필 디렉토리 경로: {profiles_dir}")
        
        # 프로필 디렉토리 확인 및 생성
        if not os.path.exists(profiles_dir):
            print("프로필 디렉토리가 없음, 생성 중...")
            os.makedirs(profiles_dir, exist_ok=True)
            
        # 기본 프로필 디렉토리 확인 및 생성
        default_profile_dir = os.path.join(profiles_dir, "default")
        if not os.path.exists(default_profile_dir):
            print("기본 프로필 디렉토리 생성 중...")
            os.makedirs(default_profile_dir, exist_ok=True)
            # 기본 프로필의 하위 디렉토리 생성
            for subdir in ["scans", "reports"]:
                os.makedirs(os.path.join(default_profile_dir, subdir), exist_ok=True)
                
        # 프로필 목록 가져오기
        profiles = [d for d in os.listdir(profiles_dir) 
                if os.path.isdir(os.path.join(profiles_dir, d))]
        
        # 'default' 프로필이 없으면 추가
        if "default" not in profiles:
            profiles.append("default")
            
        print(f"가져온 프로필 목록: {profiles}")
        return profiles
    
    def get_current_profile(self) -> str:
        """
        현재 활성화된 프로필 이름 반환
        
        Returns:
            현재 프로필 이름
        """
        if os.path.exists(self.profile_state_file):
            try:
                with open(self.profile_state_file, 'r', encoding='utf-8') as f:
                    state = json.load(f)
                    return state.get("current_profile", "default")
            except Exception as e:
                print(f"프로필 상태 파일 읽기 오류: {str(e)}")
                
        return "default"
    
    def set_current_profile(self, profile_name: str) -> Dict:
        """
        현재 프로필 설정
        
        Args:
            profile_name: 활성화할 프로필 이름
            
        Returns:
            성공 여부와 메시지
        """
        print(f"프로필 변경 요청: {profile_name}")
        
        # 기본 프로필은 항상 존재하도록 설정
        if profile_name == "default":
            print("기본 프로필로 설정 중...")
            self._ensure_default_profile_exists()
            self._save_profile_state({"current_profile": profile_name})
            return {
                "success": True,
                "message": "현재 프로필이 'default'로 설정되었습니다.",
                "current_profile": profile_name
            }
            
        profiles = self.get_profiles()
        print(f"현재 사용 가능한 프로필: {profiles}")
        
        if profile_name not in profiles:
            print(f"프로필 '{profile_name}'이 존재하지 않음")
            return {
                "success": False,
                "message": f"프로필 '{profile_name}'이 존재하지 않습니다."
            }
            
        self._save_profile_state({"current_profile": profile_name})
        print(f"프로필 '{profile_name}'으로 변경 완료")
        return {
            "success": True,
            "message": f"현재 프로필이 '{profile_name}'으로 설정되었습니다.",
            "current_profile": profile_name
        }
    
    def _ensure_default_profile_exists(self):
        """기본 프로필이 존재하는지 확인하고, 없으면 생성"""
        profiles_dir = os.path.join(self.data_dir, "profiles")
        default_profile_dir = os.path.join(profiles_dir, "default")
        
        if not os.path.exists(default_profile_dir):
            print("기본 프로필 디렉토리 생성 중...")
            os.makedirs(default_profile_dir, exist_ok=True)
            # 기본 하위 디렉토리 생성
            for subdir in ["scans", "reports"]:
                os.makedirs(os.path.join(default_profile_dir, subdir), exist_ok=True)
    
    def create_profile(self, profile_name: str) -> Dict:
        """
        새 프로필 생성
        
        Args:
            profile_name: 생성할 프로필 이름
            
        Returns:
            성공 여부와 메시지
        """
        # 이름 유효성 검사
        if not profile_name or not profile_name.strip() or len(profile_name) > 50:
            return {
                "success": False,
                "message": "유효하지 않은 프로필 이름입니다."
            }
        
        # 알파벳, 숫자, 하이픈, 언더스코어만 허용
        safe_name = ''.join(c for c in profile_name if c.isalnum() or c in '-_')
        if safe_name != profile_name:
            return {
                "success": False,
                "message": "프로필 이름은 알파벳, 숫자, 하이픈, 언더스코어만 포함할 수 있습니다."
            }
            
        profile_dir = os.path.join(self.data_dir, "profiles", safe_name)
        
        # 이미 존재하는지 확인
        if os.path.exists(profile_dir):
            return {
                "success": False,
                "message": f"프로필 '{safe_name}'이 이미 존재합니다."
            }
            
        # 프로필 디렉토리 생성
        try:
            os.makedirs(profile_dir)
            # 기본 하위 디렉토리 생성
            for subdir in ["scans", "reports"]:
                os.makedirs(os.path.join(profile_dir, subdir), exist_ok=True)
                
            return {
                "success": True,
                "message": f"프로필 '{safe_name}'이 생성되었습니다.",
                "profile_name": safe_name
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"프로필 생성 중 오류 발생: {str(e)}"
            }
    
    def delete_profile(self, profile_name: str) -> Dict:
        """
        프로필 삭제
        
        Args:
            profile_name: 삭제할 프로필 이름
            
        Returns:
            성공 여부와 메시지
        """
        # 기본 프로필은 삭제할 수 없음
        if profile_name == "default":
            return {
                "success": False,
                "message": "기본 프로필은 삭제할 수 없습니다."
            }
            
        profile_dir = os.path.join(self.data_dir, "profiles", profile_name)
        
        # 존재 여부 확인
        if not os.path.exists(profile_dir):
            return {
                "success": False,
                "message": f"프로필 '{profile_name}'이 존재하지 않습니다."
            }
            
        # 현재 프로필인 경우 기본 프로필로 변경
        current_profile = self.get_current_profile()
        if current_profile == profile_name:
            self.set_current_profile("default")
            
        # 프로필 디렉토리 삭제
        try:
            import shutil
            shutil.rmtree(profile_dir)
            
            return {
                "success": True,
                "message": f"프로필 '{profile_name}'이 삭제되었습니다.",
                "current_profile": self.get_current_profile()
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"프로필 삭제 중 오류 발생: {str(e)}"
            }
    
    def _save_profile_state(self, state: Dict) -> None:
        """
        프로필 상태 저장
        
        Args:
            state: 저장할 상태 데이터
        """
        try:
            with open(self.profile_state_file, 'w', encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"프로필 상태 저장 오류: {str(e)}")
    
    def save_scan_result(self, scan_data: Dict) -> str:
        """
        스캔 결과 저장
        
        Args:
            scan_data: 저장할 스캔 데이터
            
        Returns:
            저장된 파일 경로
        """
        # 타임스탬프 추가
        if "timestamp" not in scan_data:
            scan_data["timestamp"] = datetime.now().isoformat()
        
        filename = self._generate_filename("scan")
        
        # 현재 프로필의 스캔 디렉토리에 저장
        current_profile = self.get_current_profile()
        profile_scans_dir = os.path.join(self.data_dir, "profiles", current_profile, "scans")
        os.makedirs(profile_scans_dir, exist_ok=True)
        
        file_path = os.path.join(profile_scans_dir, filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(scan_data, f, ensure_ascii=False, indent=2)
            
        return file_path
    
    def save_report(self, report_data: Dict) -> str:
        """
        보고서 저장
        
        Args:
            report_data: 저장할 보고서 데이터
            
        Returns:
            저장된 파일 경로
        """
        # 타임스탬프 추가
        if "timestamp" not in report_data:
            report_data["timestamp"] = datetime.now().isoformat()
            
        filename = self._generate_filename("report")
        
        # 현재 프로필의 보고서 디렉토리에 저장
        current_profile = self.get_current_profile()
        profile_reports_dir = os.path.join(self.data_dir, "profiles", current_profile, "reports")
        os.makedirs(profile_reports_dir, exist_ok=True)
        
        file_path = os.path.join(profile_reports_dir, filename)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
            
        return file_path
    
    def get_scan_list(self) -> List[Dict]:
        """
        저장된 모든 스캔 목록 반환
        
        Returns:
            스캔 메타데이터 목록
        """
        current_profile = self.get_current_profile()
        profile_scans_dir = os.path.join(self.data_dir, "profiles", current_profile, "scans")
        return self._get_file_list_from_dir(profile_scans_dir, "scans")
    
    def get_report_list(self) -> List[Dict]:
        """
        저장된 모든 보고서 목록 반환
        
        Returns:
            보고서 메타데이터 목록
        """
        current_profile = self.get_current_profile()
        profile_reports_dir = os.path.join(self.data_dir, "profiles", current_profile, "reports")
        return self._get_file_list_from_dir(profile_reports_dir, "reports")
    
    def _get_file_list_from_dir(self, dir_path: str, file_type: str) -> List[Dict]:
        """
        지정된 디렉토리의 파일 목록 반환
        
        Args:
            dir_path: 디렉토리 경로
            file_type: 파일 타입 ("scans" 또는 "reports")
            
        Returns:
            파일 메타데이터 목록
        """
        result = []
        
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            return result
            
        for filename in os.listdir(dir_path):
            if not filename.endswith('.json'):
                continue
                
            file_path = os.path.join(dir_path, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    
                file_info = {
                    "id": filename.split('.')[0],
                    "filename": filename,
                    "path": file_path,
                    "timestamp": data.get("timestamp", "Unknown"),
                    "target": data.get("target", "Unknown") if file_type == "scans" else None,
                }
                
                if file_type == "reports":
                    file_info["summary"] = data.get("summary", {})
                    
                result.append(file_info)
            except Exception as e:
                print(f"파일 {filename} 읽기 오류: {str(e)}")
                
        # 시간 역순으로 정렬
        result.sort(key=lambda x: x["timestamp"], reverse=True)
        return result
    
    def get_scan_by_id(self, scan_id: str) -> Optional[Dict]:
        """
        ID로 스캔 데이터 조회
        
        Args:
            scan_id: 스캔 ID
            
        Returns:
            스캔 데이터 또는 None
        """
        current_profile = self.get_current_profile()
        profile_scans_dir = os.path.join(self.data_dir, "profiles", current_profile, "scans")
        return self._get_data_by_id_from_dir(profile_scans_dir, scan_id)
    
    def get_report_by_id(self, report_id: str) -> Optional[Dict]:
        """
        ID로 보고서 데이터 조회
        
        Args:
            report_id: 보고서 ID
            
        Returns:
            보고서 데이터 또는 None
        """
        current_profile = self.get_current_profile()
        profile_reports_dir = os.path.join(self.data_dir, "profiles", current_profile, "reports")
        return self._get_data_by_id_from_dir(profile_reports_dir, report_id)
    
    def _get_data_by_id_from_dir(self, dir_path: str, data_id: str) -> Optional[Dict]:
        """
        특정 디렉토리에서 ID로 데이터 조회
        
        Args:
            dir_path: 디렉토리 경로
            data_id: 데이터 ID
            
        Returns:
            데이터 또는 None
        """
        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            return None
            
        # 정확한 파일명 검색
        for filename in os.listdir(dir_path):
            if filename.startswith(f"{data_id}.") or filename.split('.')[0] == data_id:
                file_path = os.path.join(dir_path, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"파일 {filename} 읽기 오류: {str(e)}")
                    return None
        
        return None
        
    def delete_scan_by_id(self, scan_id: str) -> bool:
        """
        ID로 스캔 데이터 삭제
        
        Args:
            scan_id: 스캔 ID
            
        Returns:
            삭제 성공 여부
        """
        print(f"스캔 ID {scan_id} 삭제 요청 처리 중...")
        current_profile = self.get_current_profile()
        profile_scans_dir = os.path.join(self.data_dir, "profiles", current_profile, "scans")
        
        # 1. 먼저 연관된 보고서들을 찾아서 함께 삭제
        reports_to_delete = []
        profile_reports_dir = os.path.join(self.data_dir, "profiles", current_profile, "reports")
        
        if os.path.exists(profile_reports_dir):
            for filename in os.listdir(profile_reports_dir):
                if not filename.endswith('.json'):
                    continue
                    
                file_path = os.path.join(profile_reports_dir, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        report_data = json.load(f)
                        
                        # 보고서에 저장된 스캔 ID와 비교 (details에 scan_id가 있는지 확인)
                        details = report_data.get("details", {})
                        report_scan_id = details.get("scan_id", "")
                        
                        if report_scan_id == scan_id:
                            reports_to_delete.append(filename.split('.')[0])
                            print(f"삭제할 스캔 ID {scan_id}와 연관된 보고서 발견: {filename}")
                except Exception as e:
                    print(f"보고서 파일 {filename} 읽기 오류: {str(e)}")
        
        # 2. 연관된 보고서 삭제
        for report_id in reports_to_delete:
            print(f"연관된 보고서 {report_id} 삭제 중...")
            self.delete_report_by_id(report_id)
            
        # 3. 스캔 데이터 삭제
        result = self._delete_data_by_id_from_dir(profile_scans_dir, scan_id)
        if result:
            print(f"스캔 ID {scan_id} 삭제 완료")
        else:
            print(f"스캔 ID {scan_id} 삭제 실패 또는 파일 없음")
        
        return result
    
    def delete_report_by_id(self, report_id: str) -> bool:
        """
        ID로 보고서 데이터 삭제
        
        Args:
            report_id: 보고서 ID
            
        Returns:
            삭제 성공 여부
        """
        current_profile = self.get_current_profile()
        profile_reports_dir = os.path.join(self.data_dir, "profiles", current_profile, "reports")
        return self._delete_data_by_id_from_dir(profile_reports_dir, report_id)
        
    def _delete_data_by_id_from_dir(self, dir_path: str, data_id: str) -> bool:
        """
        특정 디렉토리에서 ID로 데이터 삭제
        
        Args:
            dir_path: 디렉토리 경로
            data_id: 데이터 ID
            
        Returns:
            삭제 성공 여부
        """
        if not os.path.exists(dir_path):
            return False
            
        # 정확한 파일명 검색
        for filename in os.listdir(dir_path):
            if filename.startswith(f"{data_id}.") or filename.split('.')[0] == data_id:
                file_path = os.path.join(dir_path, filename)
                try:
                    os.remove(file_path)
                    print(f"파일 {filename} 삭제 완료")
                    return True
                except Exception as e:
                    print(f"파일 {filename} 삭제 오류: {str(e)}")
                    return False
                    
        return False 