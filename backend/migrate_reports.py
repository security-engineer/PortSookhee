#!/usr/bin/env python3
import os
import json
import sys

def migrate_reports(data_dir='data'):
    """보고서 데이터의 필드 이름을 새 구조에 맞게 마이그레이션합니다."""
    print(f"마이그레이션 시작: {data_dir}")
    
    # 프로필 디렉토리 확인
    profiles_dir = os.path.join(data_dir, "profiles")
    if not os.path.exists(profiles_dir):
        print(f"프로필 디렉토리가 없습니다: {profiles_dir}")
        return False
        
    # 모든 프로필 순회
    profiles = [d for d in os.listdir(profiles_dir) if os.path.isdir(os.path.join(profiles_dir, d))]
    print(f"발견된 프로필: {', '.join(profiles)}")
    
    migrated_count = 0
    error_count = 0
    
    for profile in profiles:
        # 보고서 디렉토리 확인
        reports_dir = os.path.join(profiles_dir, profile, "reports")
        if not os.path.exists(reports_dir):
            print(f"프로필 {profile}에 reports 디렉토리가 없습니다")
            continue
            
        print(f"\n프로필 '{profile}' 처리 중...")
        report_files = [f for f in os.listdir(reports_dir) if f.endswith('.json')]
        
        if not report_files:
            print(f"  - 보고서 파일이 없습니다")
            continue
            
        print(f"  - {len(report_files)} 개의 보고서 파일 발견")
        
        # 각 보고서 파일 처리
        for filename in report_files:
            file_path = os.path.join(reports_dir, filename)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                updated = False
                updates = []
                
                # 1. vuln_results를 details로 변환
                if "vuln_results" in data and "details" not in data:
                    data["details"] = data.pop("vuln_results")
                    updated = True
                    updates.append("vuln_results → details")
                
                # 2. summary 필드 정리
                if "summary" in data:
                    # 기존 필드 이름 변환
                    if "total_hosts" in data["summary"] and "hosts_scanned" not in data["summary"]:
                        data["summary"]["hosts_scanned"] = data["summary"].pop("total_hosts")
                        updated = True
                        updates.append("total_hosts → hosts_scanned")
                    
                    if "total_vulnerabilities" in data["summary"] and "vulnerabilities_found" not in data["summary"]:
                        data["summary"]["vulnerabilities_found"] = data["summary"].pop("total_vulnerabilities") 
                        updated = True
                        updates.append("total_vulnerabilities → vulnerabilities_found")
                    
                    # 3. target_ips 필드 추가 또는 업데이트
                    has_target_ips = "target_ips" in data["summary"] and data["summary"]["target_ips"]
                    
                    if not has_target_ips and "details" in data and "hosts" in data["details"]:
                        target_ips = []
                        for host in data["details"].get("hosts", []):
                            if "host" in host and host["host"]:
                                target_ips.append(host["host"])
                        
                        if target_ips:
                            data["summary"]["target_ips"] = target_ips
                            updated = True
                            updates.append(f"target_ips 추가 ({len(target_ips)}개)")
                    
                    # 4. scan_date 추가
                    if "scan_date" not in data["summary"] and "timestamp" in data:
                        data["summary"]["scan_date"] = data["timestamp"]
                        updated = True
                        updates.append("scan_date 추가")
                
                # 변경된 경우에만 저장
                if updated:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, ensure_ascii=False, indent=2)
                    print(f"  ✅ {filename} 업데이트됨: " + ", ".join(updates))
                    migrated_count += 1
                else:
                    print(f"  ℹ️ {filename} 변경 불필요")
                    
            except Exception as e:
                print(f"  ❌ {filename} 처리 중 오류: {str(e)}")
                error_count += 1
    
    print(f"\n마이그레이션 완료: {migrated_count}개 파일 업데이트됨, {error_count}개 오류 발생")
    return migrated_count > 0

if __name__ == "__main__":
    # 커맨드라인 인자로 data_dir을 받을 수 있음
    data_dir = sys.argv[1] if len(sys.argv) > 1 else 'data'
    success = migrate_reports(data_dir)
    
    if not success:
        print("마이그레이션할 파일이 없거나 오류가 발생했습니다.")
    else:
        print("마이그레이션이 성공적으로 완료되었습니다!") 