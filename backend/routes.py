from flask import Blueprint, request, jsonify, current_app
import uuid
import datetime
import os
import json
from storage import LocalStorage  # 절대 경로로 변경
from scanner import NetworkScanner  # 절대 경로로 변경
from vpn_manager import VPNManager  # VPN 관리자 추가
from exploit_searcher import ExploitSearcher
from typing import Dict, List, Any

import nmap
import logging

# 로거 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Blueprint 생성
api = Blueprint('api', __name__)

# 스토리지 및 VPN 매니저 접근 헬퍼 함수
def get_storage():
    return current_app.config['STORAGE']

def get_vpn_manager():
    return current_app.config['VPN_MANAGER']

def get_exploit_searcher():
    """Get the ExploitSearcher instance from the app context."""
    return current_app.config['EXPLOIT_SEARCHER']

@api.route('/scan', methods=['POST'])
def scan_network():
    """네트워크 스캔 실행"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "요청 데이터가 제공되지 않았습니다"}), 400
    
    # 필수 파라미터 검증
    target = data.get('target')
    if not target:
        return jsonify({"error": "스캔 대상이 지정되지 않았습니다"}), 400
    
    # VPN 연결 상태 확인
    vpn_status = get_vpn_manager().get_status()
    is_vpn_connected = vpn_status.get("status") == "connected"
    print(f"VPN 연결 상태: {vpn_status.get('status', '알 수 없음')}")
    
    if not is_vpn_connected:
        print("주의: VPN이 연결되어 있지 않습니다. 내부 네트워크나 공개 호스트만 스캔 가능합니다.")
        
    ports = data.get('ports', '1-1000')  # 기본값: 1-1000
    arguments = data.get('arguments', '-sV')  # 기본값: 서비스 버전 스캔
    
    # Windows 환경에서는 unprivileged 옵션 추가 (VPN 스캔 지원)
    if os.name == 'nt' and '--unprivileged' not in arguments:
        arguments = f'{arguments} --unprivileged'
    
    print(f"스캔 대상: {target}, 포트: {ports}, 옵션: {arguments}")
    
    # 스캔 수행
    scanner = NetworkScanner()
    try:
        scan_result = scanner.scan_target(target, ports, arguments)
        
        # VPN 상태 정보 추가
        scan_result["vpn_status"] = {
            "connected": is_vpn_connected,
            "connection_info": vpn_status.get("connection_info", {}),
            "config": vpn_status.get("config", None)
        }
        
        # 스캔 결과 요약 출력
        host_count = len(scan_result.get("hosts", []))
        port_count = sum(len(host.get("ports", [])) for host in scan_result.get("hosts", []))
        print(f"스캔 결과 요약: {host_count}개 호스트, {port_count}개 포트 발견")
        
        if "error" in scan_result:
            print(f"스캔 오류 발생: {scan_result['error']}")
        
        # 결과 저장
        file_path = get_storage().save_scan_result(scan_result)
        scan_id = os.path.basename(file_path).split(".")[0]
        
        # 응답에 스캔 ID 추가
        scan_result["scan_id"] = scan_id
        
        return jsonify(scan_result)
    except Exception as e:
        print(f"스캔 중 예외 발생: {str(e)}")
        return jsonify({"error": str(e)}), 500

@api.route('/scan/vulns', methods=['POST'])
def check_vulnerabilities():
    """스캔 결과에 대한 취약점 분석"""
    data = request.get_json()
    
    # 스캔 ID로 검색하는 경우
    if data and 'scan_id' in data:
        scan_id = data['scan_id']
        scan_data = get_storage().get_scan_by_id(scan_id)
        if not scan_data:
            return jsonify({"error": f"스캔 ID {scan_id}를 찾을 수 없습니다"}), 404
    
    # 직접 스캔 결과를 제공하는 경우
    elif data and 'scan_results' in data:
        scan_data = data['scan_results']
    else:
        return jsonify({"error": "스캔 ID 또는 스캔 결과가 필요합니다"}), 400
    
    # 취약점 분석 실행
    scanner = NetworkScanner()
    vuln_results = scanner.check_vulns(scan_data)
    
    # 실제 취약점 분석이 구현되어야 함
    # 여기서는 간단한 더미 데이터를 반환
    
    return jsonify(vuln_results)

@api.route('/report', methods=['POST'])
def generate_report():
    """취약점 분석 결과를 기반으로 보고서 생성"""
    data = request.get_json()
    
    if not data:
        return jsonify({"error": "요청 데이터가 필요합니다."}), 400
    
    # 스캔 ID가 제공된 경우 해당 스캔 결과 조회 (이 로직을 우선시함)
    if 'scan_id' in data:
        scan_id = data['scan_id']
        logger.info(f"스캔 ID {scan_id}로 데이터 조회 중")
        
        scan_data = get_storage().get_scan_by_id(scan_id)
        if not scan_data:
            return jsonify({"error": f"스캔 ID {scan_id}를 찾을 수 없습니다."}), 404
        
        # 스캔 데이터에서 취약점 정보 확인
        has_vulnerabilities = False
        for host in scan_data.get('hosts', []):
            for port in host.get('ports', []):
                if port.get('vulnerabilities') and len(port.get('vulnerabilities')) > 0:
                    has_vulnerabilities = True
                    break
            if has_vulnerabilities:
                break
        
        # 취약점 정보가 없는 경우에만 취약점 분석 실행
        if not has_vulnerabilities:
            logger.info("스캔 결과에 취약점 정보가 없어 취약점 분석 실행")
            scanner = NetworkScanner()
            vuln_data = scanner.check_vulns(scan_data)
        else:
            logger.info("스캔 결과에 이미 취약점 정보가 있음")
            vuln_data = scan_data
    
    # 취약점 분석 결과가 직접 제공된 경우 사용
    elif 'vuln_results' in data:
        logger.info("취약점 분석 결과 직접 수신: 이 결과를 사용합니다.")
        vuln_data = data['vuln_results']
    else:
        return jsonify({"error": "스캔 ID 'scan_id' 또는 취약점 분석 결과 'vuln_results'가 필요합니다."}), 400
    
    # 보고서 요약 정보 생성
    hosts = vuln_data.get("hosts", [])
    
    # 호스트 및 취약점 수 계산
    total_vulnerabilities = 0
    
    # 포트와 취약점 계산 (빈 포트 배열 처리)
    if hosts:
        for host in hosts:
            port_list = host.get("ports", [])
            for port in port_list:
                vulnerabilities = port.get("vulnerabilities", [])
                total_vulnerabilities += len(vulnerabilities)
                
    # 디버깅 정보 추가
    logger.info(f"보고서 요약: 호스트 {len(hosts)}개, 취약점 {total_vulnerabilities}개")
    for host_idx, host in enumerate(hosts):
        logger.info(f"호스트 {host_idx+1}/{len(hosts)}: {host.get('host')}")
        for port_idx, port in enumerate(host.get('ports', [])):
            vulns = port.get('vulnerabilities', [])
            if vulns:
                logger.info(f"  - 포트 {port.get('port')}: 취약점 {len(vulns)}개")
                for v in vulns:
                    logger.info(f"    * {v.get('cve_id', 'N/A')} (점수: {v.get('cvss_score', 'N/A')})")

    # 스캔 날짜 가져오기
    scan_date = vuln_data.get("timestamp", datetime.datetime.now().isoformat())
    
    # IP 목록 추출
    target_ips = [h.get("host") for h in hosts if "host" in h]
    # 대표 타겟 주소 (vuln_data에서 직접 가져오거나 호스트 목록에서 추출)
    target = vuln_data.get("target", target_ips[0] if target_ips else "Unknown")
    
    summary = {
        "scan_date": scan_date,
        "hosts_scanned": len(hosts),
        "total_hosts": len(hosts),
        "vulnerabilities_found": total_vulnerabilities,
        "total_vulnerabilities": total_vulnerabilities,
        "risk_level": calculate_risk_level(vuln_data),
        "target_ips": target_ips,
        "target": target
    }
    
    # 보고서 내용 생성
    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "details": vuln_data,
        "summary": summary
    }
    
    # 보고서 저장
    file_path = get_storage().save_report(report)
    
    # 보고서 ID 추출 (파일명에서)
    report_id = os.path.basename(file_path).split('.')[0]
    
    # 응답에 report_id 추가
    report_with_id = {
        "report_id": report_id,
        "timestamp": report["timestamp"],
        "summary": report["summary"],
        "details": report["details"]
    }
    
    return jsonify(report_with_id)

@api.route('/scans', methods=['GET'])
def get_scan_list():
    """저장된 스캔 결과 목록 조회"""
    scans = get_storage().get_scan_list()
    return jsonify({"scans": scans})

@api.route('/reports', methods=['GET'])
def get_report_list():
    """저장된 보고서 목록 조회"""
    reports = get_storage().get_report_list()
    return jsonify({"reports": reports})

@api.route('/scans/<scan_id>', methods=['GET'])
def get_scan(scan_id):
    """특정 스캔 결과 조회"""
    scan_data = get_storage().get_scan_by_id(scan_id)
    if not scan_data:
        return jsonify({"error": f"ID {scan_id}에 해당하는 스캔을 찾을 수 없습니다."}), 404
    
    # scan_id 필드가 없는 경우 URL의 scan_id를 추가
    if 'scan_id' not in scan_data:
        scan_data['scan_id'] = scan_id
        print(f"API: scan_id 필드를 추가했습니다 - {scan_id}")
    
    return jsonify(scan_data)

@api.route('/scans/<scan_id>', methods=['DELETE'])
def delete_scan(scan_id):
    """특정 스캔 결과 삭제"""
    success = get_storage().delete_scan_by_id(scan_id)
    if not success:
        return jsonify({"error": f"ID {scan_id}에 해당하는 스캔을 삭제할 수 없습니다."}), 404
    return jsonify({"success": True})

@api.route('/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    """특정 보고서 조회"""
    report_data = get_storage().get_report_by_id(report_id)
    if not report_data:
        return jsonify({"error": f"ID {report_id}에 해당하는 보고서를 찾을 수 없습니다."}), 404
    return jsonify(report_data)

@api.route('/reports/<report_id>', methods=['DELETE'])
def delete_report(report_id):
    """Deletes a specific report."""
    success = get_storage().delete_report_by_id(report_id)
    if not success:
        return jsonify({"error": f"ID {report_id}에 해당하는 보고서를 삭제할 수 없습니다."}), 404
    return jsonify({"success": True})

def calculate_risk_level(vuln_results):
    """취약점 결과에 따른 리스크 레벨 계산"""
    # 모든 취약점의 CVSS 점수 추출
    cvss_scores = []
    for host in vuln_results.get("hosts", []):
        for port in host.get("ports", []):
            for vuln in port.get("vulnerabilities", []):
                if "cvss_score" in vuln:
                    cvss_scores.append(vuln["cvss_score"])
    
    if not cvss_scores:
        return "없음"
    
    # 최대 CVSS 점수
    max_cvss = max(cvss_scores) if cvss_scores else 0
    
    # CVSS 점수에 따른 리스크 레벨 결정
    if max_cvss >= 9.0:
        return "심각"
    elif max_cvss >= 7.0:
        return "높음"
    elif max_cvss >= 4.0:
        return "중간"
    elif max_cvss > 0:
        return "낮음"
    else:
        return "없음"

# VPN 관련 엔드포인트 추가
@api.route('/vpn/configs', methods=['GET'])
def get_vpn_configs():
    """저장된 VPN 설정 파일 목록 조회"""
    configs = get_vpn_manager().list_configs()
    return jsonify({"configs": configs})

@api.route('/vpn/configs', methods=['POST'])
def upload_vpn_config():
    """VPN 설정 파일 업로드"""
    if 'file' not in request.files:
        return jsonify({"error": "파일이 제공되지 않았습니다"}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "파일이 선택되지 않았습니다"}), 400
        
    if not file.filename.endswith('.ovpn'):
        return jsonify({"error": ".ovpn 파일만 업로드 가능합니다"}), 400
    
    try:
        # 설정 파일 저장
        get_vpn_manager().save_config(file.filename, file.read())
        
        # 응답
        return jsonify({
            "status": "success", 
            "message": "VPN 설정 파일이 업로드되었습니다"
        })
    except Exception as e:
        return jsonify({"error": f"VPN 설정 파일 업로드 오류: {str(e)}"}), 500

@api.route('/vpn/configs/<config_name>', methods=['DELETE'])
def delete_vpn_config(config_name):
    """VPN 설정 파일 삭제"""
    result = get_vpn_manager().delete_config(config_name)
    
    if result['status'] == 'error':
        return jsonify(result), 400
        
    return jsonify(result)

@api.route('/vpn/connect', methods=['POST'])
def connect_vpn():
    """VPN 연결 시작"""
    data = request.get_json()
    
    if not data or 'config_name' not in data:
        return jsonify({"error": "설정 파일 'config_name'이 필요합니다."}), 400
        
    config_name = data['config_name']
    print(f"VPN 연결 시도: {config_name}")
    
    try:
        # VPN 매니저 가져오기
        vpn_manager = get_vpn_manager()
        
        # 현재 프로필 확인
        storage = get_storage()
        current_profile = storage.get_current_profile()
        print(f"현재 프로필: {current_profile}")
        
        # 프로필 디렉토리 확인
        vpn_dir = vpn_manager.get_profile_vpn_dir()
        config_path = os.path.join(vpn_dir, config_name)
        
        print(f"VPN 설정 파일 경로: {config_path}")
        print(f"VPN 설정 파일 존재 여부: {os.path.exists(config_path)}")
        
        if not os.path.exists(config_path):
            # 모든 가능한 경로에서 설정 파일 찾기
            print("VPN 설정 파일 탐색 중...")
            found_paths = []
            for root, _, files in os.walk(vpn_manager.base_config_dir):
                for file in files:
                    if file == config_name:
                        found_paths.append(os.path.join(root, file))
            
            print(f"발견된 설정 파일 경로: {found_paths}")
            if found_paths:
                # 첫 번째 발견된 경로 사용
                config_path = found_paths[0]
                config_name = os.path.basename(config_path)
                print(f"사용할 설정 파일: {config_path}")
        
        # OpenVPN 설치 확인
        openvpn_path = vpn_manager._get_openvpn_path()
        print(f"OpenVPN 경로: {openvpn_path}")
        
        if not openvpn_path:
            return jsonify({"error": "OpenVPN이 설치되어 있지 않습니다. 서버에 OpenVPN을 설치해주세요."}), 500
            
        # VPN 연결
        print(f"VPN 연결 시작: {config_name}")
        result = vpn_manager.connect(config_name)
        print(f"VPN 연결 결과: {result}")
        
        if result['status'] == 'error':
            # 더 자세한 오류 정보 추가
            error_msg = result.get('message', '알 수 없는 오류')
            
            # 로그 파일이 있으면 마지막 10줄 가져오기
            log_content = ""
            try:
                with open(vpn_manager.log_path, 'r', encoding='utf-8', errors='ignore') as f:
                    log_lines = f.readlines()
                    log_content = "".join(log_lines[-10:])  # 마지막 10줄
            except Exception as e:
                log_content = f"로그 파일 읽기 오류: {str(e)}"
                
            return jsonify({
                "error": error_msg, 
                "details": {
                    "log_excerpt": log_content,
                    "config_path": config_path,
                    "openvpn_path": openvpn_path
                }
            }), 500
            
        return jsonify(result)
        
    except Exception as e:
        import traceback
        trace = traceback.format_exc()
        print(f"VPN 연결 중 예외 발생: {str(e)}\n{trace}")
        return jsonify({"error": str(e), "traceback": trace}), 500

@api.route('/vpn/disconnect', methods=['POST'])
def disconnect_vpn():
    """VPN 연결 종료"""
    result = get_vpn_manager().disconnect()
    return jsonify(result)

@api.route('/vpn/status', methods=['GET'])
def get_vpn_status():
    """VPN 연결 상태 및 프로필 정보를 함께 조회"""
    vpn_manager = get_vpn_manager()
    storage = get_storage()

    # 1. VPN 연결 상태 가져오기
    status_data = vpn_manager.get_status()

    # 2. 현재 활성화된 프로필 이름 가져오기
    try:
        current_profile = storage.get_current_profile()
        # 상태 정보에 프로필 이름을 명시적으로 추가
        status_data['profile_name'] = current_profile
    except Exception as e:
        logger.error(f"현재 프로필을 가져오는 중 오류 발생: {e}")
        status_data['profile_name'] = None

    # 3. 최종 데이터 반환
    return jsonify(status_data)

@api.route('/vpn/log', methods=['GET'])
def get_vpn_log():
    """VPN 로그 조회"""
    log = get_vpn_manager().get_vpn_log()
    return jsonify({"log": log})

# 프로필 관련 엔드포인트
@api.route('/profiles', methods=['GET'])
def get_profiles():
    """프로필 목록 조회"""
    profiles = get_storage().get_profiles()
    current_profile = get_storage().get_current_profile()
    
    return jsonify({
        "profiles": profiles,
        "current_profile": current_profile
    })

@api.route('/profiles', methods=['POST'])
def create_profile():
    """새 프로필 생성"""
    data = request.get_json()
    
    if not data or 'profile_name' not in data:
        return jsonify({"error": "프로필 이름 'profile_name'이 필요합니다."}), 400
        
    profile_name = data['profile_name']
    result = get_storage().create_profile(profile_name)
    
    if not result['success']:
        return jsonify({"error": result['message']}), 400
        
    return jsonify(result)

@api.route('/profiles/current', methods=['GET'])
def get_current_profile():
    """현재 프로필 조회"""
    current_profile = get_storage().get_current_profile()
    return jsonify({"current_profile": current_profile})

@api.route('/profiles/current', methods=['POST'])
def set_current_profile():
    """현재 프로필 설정"""
    data = request.get_json()
    
    print(f"프로필 변경 요청 데이터: {data}")  # 요청 데이터 로깅
    
    if not data or 'profile_name' not in data:
        print("프로필 이름이 제공되지 않았습니다.")  # 오류 로깅
        return jsonify({"error": "프로필 이름이 제공되지 않았습니다."}), 400
        
    profile_name = data['profile_name']
    print(f"변경하려는 프로필: {profile_name}")  # 프로필 이름 로깅
    
    # 현재 사용 가능한 프로필 목록 확인 
    available_profiles = get_storage().get_profiles()
    print(f"사용 가능한 프로필 목록: {available_profiles}")  # 프로필 목록 로깅
    
    result = get_storage().set_current_profile(profile_name)
    print(f"프로필 변경 결과: {result}")  # 결과 로깅
    
    if not result['success']:
        return jsonify({"error": result['message']}), 400
        
    return jsonify(result)

@api.route('/profiles/<profile_name>', methods=['DELETE'])
def delete_profile(profile_name):
    """프로필 삭제"""
    result = get_storage().delete_profile(profile_name)
    
    if not result['success']:
        return jsonify({"error": result['message']}), 400
        
    return jsonify(result)

# 네트워크 연결 테스트 엔드포인트 추가
@api.route('/network/test', methods=['POST'])
def test_network_connection():
    """네트워크 연결 테스트 (핑 및 포트스캔)"""
    data = request.get_json()
    
    if not data or 'target' not in data:
        return jsonify({"error": "테스트 대상이 지정되지 않았습니다"}), 400
        
    target = data['target']
    port = data.get('port', '80')  # 기본 포트 80
    
    results = {}
    
    # VPN 연결 상태
    vpn_status = get_vpn_manager().get_status()
    results["vpn_status"] = {
        "connected": vpn_status.get("status") == "connected",
        "connection_info": vpn_status.get("connection_info", {})
    }
    
    try:
        import subprocess
        import socket
        import time
        
        # PING 테스트
        try:
            if os.name == 'nt':  # Windows
                ping_cmd = subprocess.run(['ping', '-n', '1', '-w', '2000', target], 
                                         capture_output=True, text=True, timeout=3)
            else:  # Linux/Docker
                ping_cmd = subprocess.run(['ping', '-c', '1', '-W', '2', target], 
                                         capture_output=True, text=True, timeout=3)
                                         
            results["ping"] = {
                "success": ping_cmd.returncode == 0,
                "output": ping_cmd.stdout
            }
        except Exception as e:
            results["ping"] = {"error": str(e)}
        
        # TCP 연결 테스트
        try:
            start_time = time.time()
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((target, int(port)))
            elapsed = time.time() - start_time
            
            results["tcp_connect"] = {
                "success": result == 0,
                "port": port,
                "elapsed_ms": round(elapsed * 1000, 2),
                "error_code": result
            }
        except Exception as e:
            results["tcp_connect"] = {"error": str(e)}
            
        # traceroute 테스트 (Linux만)
        if os.name != 'nt':
            try:
                traceroute_cmd = subprocess.run(['traceroute', '-w', '1', '-m', '10', target], 
                                               capture_output=True, text=True, timeout=5)
                results["traceroute"] = {
                    "output": traceroute_cmd.stdout
                }
            except Exception as e:
                results["traceroute"] = {"error": str(e)}
        
        # mini-nmap 테스트
        try:
            scanner = NetworkScanner()
            scan_result = scanner.scan_target(target, port, "-sV --unprivileged -T4")
            
            # 결과 간소화
            simplified = {
                "hosts": len(scan_result.get("hosts", [])),
                "ports": []
            }
            
            for host in scan_result.get("hosts", []):
                for port_info in host.get("ports", []):
                    simplified["ports"].append({
                        "port": port_info.get("port"),
                        "state": port_info.get("state"),
                        "service": port_info.get("service"),
                        "product": port_info.get("product")
                    })
                    
            results["nmap"] = simplified
        except Exception as e:
            results["nmap"] = {"error": str(e)}
            
    except Exception as e:
        results["error"] = str(e)
    
    return jsonify(results)

@api.route('/searchsploit', methods=['GET'])
def search_exploits_route():
    """Searches for exploits using searchsploit."""
    query = request.args.get('query')
    if not query:
        return jsonify({"error": "검색어 'query' 파라미터가 필요합니다."}), 400

    searcher = get_exploit_searcher()
    results = searcher.search(query)

    if 'error' in results:
        return jsonify(results), 500

    return jsonify(results)

@api.route('/exploit-file', methods=['GET'])
def get_exploit_file_route():
    """
    Searchsploit 결과에서 찾은 익스플로잇 파일을 다운로드합니다.
    
    Query 파라미터:
    - path: 익스플로잇 파일 경로 (예: /root/exploitdb/exploits/linux/webapps/47138.py)
    """
    file_path = request.args.get('path')
    if not file_path:
        return jsonify({"error": "파일 경로가 제공되지 않았습니다."}), 400
    
    logger.info(f"익스플로잇 파일 요청: {file_path}")
    
    # 익스플로잇 파일 가져오기
    searcher = get_exploit_searcher()
    file_content, file_name = searcher.get_exploit_file(file_path)
    
    if file_content is None:
        return jsonify({"error": file_name}), 404
    
    # MIME 타입 추정
    mime_type = "text/plain"  # 기본값
    if file_path.endswith('.py'):
        mime_type = "text/x-python"
    elif file_path.endswith('.php'):
        mime_type = "application/x-php"
    elif file_path.endswith('.rb'):
        mime_type = "text/x-ruby"
    elif file_path.endswith('.sh'):
        mime_type = "text/x-sh"
    elif file_path.endswith('.txt'):
        mime_type = "text/plain"
    elif file_path.endswith('.html') or file_path.endswith('.htm'):
        mime_type = "text/html"
    elif file_path.endswith('.js'):
        mime_type = "text/javascript"
    elif file_path.endswith('.c'):
        mime_type = "text/x-c"
    elif file_path.endswith('.cpp'):
        mime_type = "text/x-c++"
    
    # 파일 다운로드 응답 생성
    from flask import send_file
    from io import BytesIO
    
    return send_file(
        BytesIO(file_content),
        mimetype=mime_type,
        as_attachment=True,
        download_name=file_name
    ) 