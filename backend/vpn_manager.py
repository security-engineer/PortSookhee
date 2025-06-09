#!/usr/bin/env python3
# vpn_manager.py
# ──────────────────────────────────────────────────────────
import os
import subprocess
import time
from typing import Dict, List, Optional, Any, Tuple
import logging
import shutil
import shlex
import signal
import json
import traceback
import re

# --------- 로깅 설정 ----------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vpn_manager")
# --------------------------------


class VPNManager:
    """
    OpenVPN 연결 관리 클래스 (컨테이너/리눅스/윈도우 공통)
    """

    def __init__(
        self, config_dir: str, storage_manager=None, log_path: str = "openvpn.log"
    ):
        """초기화"""
        self.base_config_dir = config_dir
        self.storage_manager = storage_manager  # 스토리지 매니저 참조
        self.session: Dict[str, Any] = {}
        self._reset_session()
        self.log_path = log_path

        # Windows 용 OpenVPN 기본 경로 후보
        self.openvpn_paths = [
            r"C:\Program Files\OpenVPN\bin\openvpn.exe",
            r"C:\Program Files (x86)\OpenVPN\bin\openvpn.exe",
            "openvpn"  # 환경 변수에 등록된 경우
        ]

        # 서버 시작 시, 이전 세션의 잔여 OpenVPN 프로세스가 있을 수 있으므로 정리합니다.
        # 이는 서버 재시작 후 연결 시 발생할 수 있는 충돌을 방지합니다.
        self._cleanup_stale_processes()

        # Docker 환경에서 OpenVPN 설치 확인 및 설치 시도
        if os.name != "nt" and not self._is_openvpn_installed():
            logger.warning("OpenVPN이 설치되어 있지 않습니다. 설치를 시도합니다...")
            self._install_openvpn()

        self._ensure_config_dir_exists()
        
        # Docker/Linux 환경에서 TUN 디바이스 초기화
        if os.name != "nt" and not os.path.exists("/dev/net/tun"):
            try:
                # TUN 디바이스 생성 시도
                logger.info("TUN 디바이스 초기화 시도")
                os.makedirs("/dev/net", exist_ok=True)
                if not os.path.exists("/dev/net/tun"):
                    subprocess.run(["mknod", "/dev/net/tun", "c", "10", "200"], check=False)
                    subprocess.run(["chmod", "600", "/dev/net/tun"], check=False)
                    logger.info("TUN 디바이스 생성 완료")
            except Exception as e:
                logger.error(f"TUN 디바이스 초기화 실패: {str(e)}")

    # ===================================================================
    # Public API
    # ===================================================================

    def connect(self, config_name: str) -> Dict:
        """지정된 설정으로 VPN 연결을 시도합니다."""
        if self.session["status"] != "disconnected":
            self.disconnect()

        logger.info(f"==== VPN 연결 시작: {config_name} ====")

        # 1. 설정 파일 경로 확인
        config_path = self._find_config_file(config_name)
        if not config_path:
            return {"status": "error", "message": f"설정 파일 '{config_name}'을(를) 찾을 수 없습니다."}

        # 2. OpenVPN 실행 명령어 생성 (인증 포함)
        command, error_msg = self._build_connect_command(config_path, config_name)
        if error_msg:
            return {"status": "error", "message": error_msg}

        # 3. OpenVPN 프로세스 시작 및 모니터링
        return self._start_and_monitor_process(command, config_name)

    def disconnect(self) -> Dict:
        """현재 VPN 연결을 종료합니다."""
        logger.info("VPN 연결 종료 시도...")
        process = self.session.get("process")

        if process:
            logger.info(f"OpenVPN 프로세스(PID: {process.pid}) 종료 중...")
            try:
                # 프로세스 그룹 전체에 시그널 보내기 (Linux/Mac)
                if os.name != 'nt':
                    os.killpg(os.getpgid(process.pid), signal.SIGTERM)
                else: # Windows
                    process.terminate()

                process.wait(timeout=5)
                logger.info("프로세스가 정상적으로 종료되었습니다.")
            except ProcessLookupError:
                logger.warning("프로세스가 이미 존재하지 않습니다.")
            except subprocess.TimeoutExpired:
                logger.warning("프로세스가 시간 초과되어 강제 종료합니다.")
                if os.name != 'nt':
                    os.killpg(os.getpgid(process.pid), signal.SIGKILL)
                else:
                    process.kill()
            except Exception as e:
                logger.error(f"프로세스 종료 중 오류 발생: {e}")

        # 만약의 경우를 대비해 시스템에 남아있는 모든 openvpn 프로세스 정리
        self._cleanup_stale_processes()
        
        self._reset_session()
        return {"status": "success", "message": "VPN 연결이 종료되었습니다."}

    def get_status(self) -> Dict:
        """현재 VPN 연결 상태 반환"""
        self._read_logs_from_process()

        # 연결 중에 프로세스가 예기치 않게 종료된 경우
        if self.session["status"] == "connecting" and self.session["process"] and self.session["process"].poll() is not None:
            self.session["status"] = "error"
            logger.warning("연결 중 프로세스가 예기치 않게 종료되었습니다.")

        # 연결된 상태에서 TUN 인터페이스가 사라진 경우 (연결 끊김 감지)
        if self.session["status"] == "connected" and not self._check_tun_interface():
            logger.warning("VPN 연결(tun 인터페이스)이 끊어진 것을 감지했습니다.")
            self.disconnect() # 세션을 완전히 정리
        
        # 연결된 상태라면, 항상 최신 연결 정보를 가져와서 갱신합니다.
        # 이렇게 하면, 최초 정보 로딩 실패 시에도 후속 상태 조회에서 복구할 수 있습니다.
        if self.session["status"] == "connected":
            self.session["connection_info"] = self._get_connection_info()

        status_info = {
            "status": self.session["status"],
            "config": self.session["config_name"],
            "connection_info": self.session["connection_info"],
        }

        # 연결 실패 또는 오류 시 로그 일부를 메시지로 포함
        if self.session["status"] in ["error", "disconnected"]:
             log_excerpt = "\n".join(self.session["logs"][-15:])
             status_info["message"] = f"현재 연결되지 않았습니다.\n{log_excerpt}"

        return status_info

    def is_connected(self) -> bool:
        """연결 상태를 boolean으로 반환"""
        return self._check_tun_interface() and self.session["status"] == "connected"

    def list_configs(self) -> List[Dict]:
        profile_dir = self.get_profile_vpn_dir()
        logger.info(f"VPN 설정 목록 디렉토리: {profile_dir}")
        
        if not os.path.exists(profile_dir):
            logger.warning(f"VPN 설정 디렉토리가 존재하지 않음: {profile_dir}")
            os.makedirs(profile_dir, exist_ok=True)
            return []
            
        return [
            {
                "name": fn,
                "path": os.path.join(profile_dir, fn),
                "size": os.path.getsize(os.path.join(profile_dir, fn)),
                "modified": os.path.getmtime(os.path.join(profile_dir, fn)),
            }
            for fn in os.listdir(profile_dir)
            if fn.endswith(".ovpn")
        ]

    def save_config(self, config_name: str, config_content: bytes) -> str:
        safe_name = "".join(c for c in config_name if c.isalnum() or c in "._-")
        if not safe_name.endswith(".ovpn"):
            safe_name += ".ovpn"
        
        # 스토리지 매니저 디버그 정보
        logger.info(f"스토리지 매니저 설정됨: {self.storage_manager is not None}")
        if self.storage_manager:
            try:
                current_profile = self.storage_manager.get_current_profile()
                logger.info(f"현재 프로필: {current_profile}")
            except Exception as e:
                logger.error(f"프로필 조회 오류: {str(e)}")
        
        profile_dir = self.get_profile_vpn_dir()
        logger.info(f"VPN 설정 저장 디렉토리: {profile_dir}")
        
        file_path = os.path.join(profile_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(config_content)
        logger.info(f"VPN 설정 파일 저장: {file_path}")
        return file_path

    def delete_config(self, config_name: str) -> Dict:
        if self.session.get("config_name") == config_name:
            self.disconnect()
        
        path = self._find_config_file(config_name)
        if not path:
            return {"status": "error", "message": f"설정 파일 '{config_name}'을(를) 찾을 수 없습니다."}

        try:
            os.remove(path)
            # 관련 .auth 파일도 삭제
            auth_path = os.path.splitext(path)[0] + ".auth"
            if os.path.exists(auth_path):
                os.remove(auth_path)
                logger.info(f"관련 인증 파일 삭제: {auth_path}")

            return {"status": "success", "message": f"'{config_name}' 설정이 삭제되었습니다."}
        except FileNotFoundError:
            return {"status": "error", "message": "파일을 찾을 수 없습니다."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def get_vpn_log(self) -> str:
        if self.session["logs"]:
            return "\n".join(self.session["logs"])
        return "표시할 로그가 없습니다."

    # ===================================================================
    # Internal State & Process Management
    # ===================================================================

    def _cleanup_stale_processes(self):
        """시스템에 남아있을 수 있는 이전 OpenVPN 프로세스를 정리합니다."""
        if os.name == 'nt':
            # Windows에서는 taskkill 을 사용할 수 있으나, 이 프로젝트에서는 Docker/Linux 환경에 집중합니다.
            return

        try:
            # pkill이 더 구체적인 패턴으로 프로세스를 찾아 종료하므로 killall보다 선호됩니다.
            logger.info("이전 OpenVPN 프로세스를 정리합니다 (pkill -f 'openvpn --config')...")
            result = subprocess.run(
                ["pkill", "-f", "openvpn --config"],
                check=False, timeout=5, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
            # pkill이 없거나 (exit_code=127) 실패한 경우 killall로 fallback (Alpine 등)
            if result.returncode != 0:
                logger.info("pkill 실패 또는 찾을 수 없음, killall 로 재시도...")
                subprocess.run(
                    ["killall", "-9", "openvpn"],
                    check=False, timeout=5, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
        except FileNotFoundError: # pkill 자체가 없는 경우
            logger.info("pkill을 찾을 수 없음, killall 로 재시도...")
            try:
                subprocess.run(
                    ["killall", "-9", "openvpn"],
                    check=False, timeout=5, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
                )
            except FileNotFoundError:
                logger.warning("pkill 및 killall을 모두 찾을 수 없습니다. 프로세스 정리를 건너뜁니다.")
        except Exception as e:
            logger.warning(f"잔여 프로세스 정리 중 오류 발생: {e}")

    def _reset_session(self):
        """현재 연결 세션을 초기화합니다."""
        self.session = {
            "process": None,
            "config_name": None,
            "status": "disconnected",  # "disconnected", "connecting", "connected", "error"
            "logs": [],
            "connection_info": {},
        }

    def _build_connect_command(self, config_path: str, config_name: str) -> Tuple[Optional[List[str]], Optional[str]]:
        """OpenVPN 실행 명령어를 준비하고 인증 요구사항을 확인합니다."""
        # OpenVPN 실행 파일 경로 확인
        openvpn_path = self._get_openvpn_path()
        if not openvpn_path:
            return None, "OpenVPN 실행 파일을 찾을 수 없습니다."

        # 인증 파일(.auth) 필요 여부 확인
        auth_file_path = None
        try:
            with open(config_path, 'r', encoding='utf-8', errors='ignore') as f:
                if any(line.strip().startswith('auth-user-pass') for line in f):
                    logger.info(f"'{config_name}' 설정 파일에 'auth-user-pass'가 필요합니다.")
                    base_path = os.path.splitext(config_path)[0]
                    auth_file_path = base_path + ".auth"
                    
                    if not os.path.exists(auth_file_path):
                        message = f"VPN 설정({config_name})에 사용자 인증이 필요합니다. '{os.path.basename(auth_file_path)}' 파일을 생성하고, 첫 줄에 사용자 이름, 둘째 줄에 비밀번호를 입력해주세요."
                        logger.error(message)
                        return None, message
                    else:
                        logger.info(f"인증 파일 발견: {auth_file_path}")
        except Exception as e:
            logger.warning(f"ovpn 파일 읽기 중 오류 발생: {e}")

        # 명령어 리스트 구성
        command = [openvpn_path, "--config", config_path]
        if auth_file_path:
            command.extend(["--auth-user-pass", auth_file_path])
        
        # 호환성 및 로깅 옵션 추가
        command.extend(["--data-ciphers", "AES-256-GCM:AES-128-GCM:AES-256-CBC:AES-128-CBC"])
        command.extend(["--allow-compression", "yes"])
        command.extend(["--verb", "4"])

        return command, None
    
    def _start_and_monitor_process(self, command: List[str], config_name: str) -> Dict:
        """프로세스를 시작하고, 연결 완료 또는 실패를 모니터링합니다."""
        try:
            logger.info(f"OpenVPN 실행 명령어: {' '.join(command)}")
            
            # 새 세션 시작
            self._reset_session()
            self.session["config_name"] = config_name
            self.session["status"] = "connecting"

            process = subprocess.Popen(
                command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding='utf-8',
                errors='replace',
                preexec_fn=os.setsid if os.name != 'nt' else None
            )
            self.session["process"] = process

            # 연결 완료 또는 실패/타임아웃 대기 (최대 20초)
            timeout = 20
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                self._read_logs_from_process()

                # 성공 케이스
                if "Initialization Sequence Completed" in "\n".join(self.session["logs"]):
                    logger.info("연결 초기화 시퀀스 완료. 네트워크 인터페이스 설정을 위해 1초 대기...")
                    time.sleep(1) # OS가 tun 인터페이스를 설정하고 IP를 할당할 시간을 줍니다.

                    self.session["status"] = "connected"
                    self.session["connection_info"] = self._get_connection_info()
                    logger.info(f"VPN 연결 성공: {config_name}")
                    return {"status": "success", "message": "VPN이 성공적으로 연결되었습니다."}
                
                # 실패 케이스 (프로세스 조기 종료)
                if process.poll() is not None:
                    log_excerpt = "\n".join(self.session["logs"][-15:])
                    logger.error(f"OpenVPN 프로세스가 예기치 않게 종료되었습니다. 종료 코드: {process.poll()}")
                    self.disconnect()
                    return {"status": "error", "message": f"OpenVPN 프로세스 종료됨. 로그:\n{log_excerpt}"}
                
                time.sleep(0.5)

            # 타임아웃 케이스
            log_excerpt = "\n".join(self.session["logs"][-15:])
            self.disconnect()
            return {"status": "error", "message": f"VPN 연결 시간 초과. 로그:\n{log_excerpt}"}

        except Exception as e:
            logger.error(f"OpenVPN 실행 중 예외 발생: {str(e)}\n{traceback.format_exc()}")
            self.disconnect()
            return {"status": "error", "message": f"VPN 연결 중 예외 발생: {str(e)}"}

    def _read_logs_from_process(self) -> None:
        """Popen 프로세스에서 논블로킹으로 로그를 읽고 세션에 저장합니다."""
        process = self.session.get("process")
        if not process or not process.stdout:
            return

        # 논블로킹으로 읽기 위해 fcntl 사용 (Linux/Mac)
        if os.name != 'nt':
            import fcntl
            fd = process.stdout.fileno()
            fl = fcntl.fcntl(fd, fcntl.F_GETFL)
            fcntl.fcntl(fd, fcntl.F_SETFL, fl | os.O_NONBLOCK)

        try:
            # 한번에 읽을 수 있는 모든 로그를 가져옴
            output = process.stdout.read()
            if output:
                new_logs = [log for log in output.strip().split('\n') if log]
                self.session["logs"].extend(new_logs)
                # 메모리 관리를 위해 최근 200줄의 로그만 유지
                self.session["logs"] = self.session["logs"][-200:]
        except (TypeError, BlockingIOError):
            pass # 읽을 데이터가 없을 때 발생하는 정상적인 예외
        except Exception as e:
            logger.warning(f"프로세스 로그 읽기 오류: {e}")
    
    # ===================================================================
    # Internal Utilities
    # ===================================================================

    def _get_openvpn_path(self) -> Optional[str]:
        """OS별 openvpn 실행 파일 탐색"""
        if os.name != "nt":
            # Docker/Linux 환경에서는 'which' 명령어로 경로 탐색
            try:
                result = subprocess.run(['which', 'openvpn'], 
                                        stdout=subprocess.PIPE, 
                                        stderr=subprocess.PIPE,
                                        text=True)
                if result.returncode == 0:
                    return result.stdout.strip()
                else:
                    logger.error("OpenVPN이 시스템에 설치되어 있지 않습니다. 'apt-get install openvpn' 또는 'apk add openvpn' 명령으로 설치하세요.")
                    return None
            except Exception as e:
                logger.error(f"OpenVPN 경로 확인 오류: {str(e)}")
                return None
        # Windows에서는 미리 정의된 경로 후보 목록에서 탐색
        for path in self.openvpn_paths:
            if os.path.isfile(path):
                return path
        # 찾지 못한 경우
        logger.error("OpenVPN 실행 파일을 찾을 수 없습니다.")
        return None

    def _find_config_file(self, config_name: str) -> Optional[str]:
        """지정된 설정 파일을 여러 위치에서 찾습니다."""
        
        # 1. 현재 프로필의 디렉토리에서 검색
        profile_dir = self.get_profile_vpn_dir()
        path1 = os.path.join(profile_dir, config_name)
        if os.path.isfile(path1):
            return path1

        # 2. 모든 프로필 디렉토리에서 검색
        if self.storage_manager:
            try:
                profiles = self.storage_manager.get_profiles()
                for profile in profiles:
                    path = os.path.join(self.base_config_dir, profile, config_name)
                    if os.path.isfile(path):
                        return path
            except Exception as e:
                logger.warning(f"프로필 목록 조회 중 오류: {e}")

        # 3. 전체 설정 디렉토리 재귀 검색 (최후의 수단)
        logger.warning(f"표준 경로에서 '{config_name}'을(를) 찾지 못해 전체 디렉토리를 검색합니다.")
        for root, _, files in os.walk(self.base_config_dir):
            if config_name in files:
                found_path = os.path.join(root, config_name)
                logger.info(f"재귀 검색으로 파일 발견: {found_path}")
                return found_path
        
        return None

    def _check_tun_interface(self) -> bool:
        """tun 인터페이스 존재 여부로 연결 상태를 간단히 확인합니다."""
        if os.name == 'nt':
            # Windows에서는 프로세스 생존 여부로 대체
            process = self.session.get("process")
            return process is not None and process.poll() is None

        # Linux/Unix: /sys/class/net에 'tun'으로 시작하는 인터페이스가 있는지 확인
        try:
            net_devices = os.listdir('/sys/class/net/')
            return any(dev.startswith('tun') for dev in net_devices)
        except FileNotFoundError:
            # 대체 수단: 'ip' 명령어 사용
            try:
                result = subprocess.run(['ip', 'addr'], capture_output=True, text=True)
                # 정규식으로 'tun' 인터페이스 확인 (예: "3: tun0: <...")
                return bool(re.search(r'^\d+:\s+tun\d+', result.stdout, re.MULTILINE))
            except FileNotFoundError:
                return False # 'ip' 명령어 없음

    def _get_connection_info(self) -> Dict:
        """현재 VPN 연결 정보 (IP, 게이트웨이, DNS, 라우트 등)를 파싱합니다."""
        info = {"local_ip": "", "gateway": "", "dns": [], "routes": []}
        
        try:
            if os.name == "nt":  # Windows
                self._get_windows_connection_info(info)
            else:  # Linux/Unix (Docker 포함)
                self._get_linux_connection_info(info)
        except Exception as e:
            logger.error(f"연결 정보 확인 중 예외 발생: {str(e)}\n{traceback.format_exc()}")
            
        return info

    def _get_windows_connection_info(self, info: Dict):
        """Windows 환경에서 ipconfig를 파싱하여 연결 정보를 가져옵니다."""
        try:
            output = subprocess.check_output("ipconfig /all", shell=True, text=True)
            adapter_section = ""
            # "TAP-Windows Adapter V9" 또는 "OpenVPN Wintun"과 같은 최신 어댑터 이름 포함
            for line in output.split('\n\n'):
                if "TAP-Windows" in line or "OpenVPN" in line or "Wintun" in line:
                    adapter_section = line
                    break
            
            if not adapter_section:
                logger.warning("OpenVPN 네트워크 어댑터를 찾을 수 없습니다.")
                return

            ip_match = re.search(r"IPv4 Address[.\s]*: ([0-9.]+)", adapter_section)
            if ip_match:
                info["local_ip"] = ip_match.group(1)
            
            gw_match = re.search(r"Default Gateway[.\s]*: ([\d\w.:]+)", adapter_section)
            if gw_match and gw_match.group(1) != "0.0.0.0":
                 info["gateway"] = gw_match.group(1)

            dns_servers = re.findall(r"DNS Servers[.\s]*: ([\d\w.:]+)", adapter_section)
            info["dns"] = [dns for dns in dns_servers if dns != "0.0.0.0"]

        except subprocess.CalledProcessError as e:
            logger.error(f"ipconfig 실행 오류: {e}")
        except Exception as e:
            logger.error(f"Windows 연결 정보 파싱 오류: {e}")


    def _get_linux_connection_info(self, info: Dict):
        """Linux 환경에서 'ip' 명령어를 파싱하여 연결 정보를 가져옵니다."""
        try:
            # 1. tun 인터페이스 찾기
            interfaces = os.listdir('/sys/class/net') if os.path.exists('/sys/class/net') else []
            tun_interface = next((i for i in interfaces if i.startswith('tun')), None)
            
            if not tun_interface:
                logger.warning("활성화된 'tun' 인터페이스를 찾을 수 없습니다.")
                return

            # 2. 'ip addr show' 명령으로 IP 및 게이트웨이(peer) 정보 파싱
            addr_output = subprocess.check_output(f"ip addr show {tun_interface}", shell=True, text=True)
            
            # 로컬 IP 주소 (예: "inet 10.8.0.2/24 ...")
            ip_match = re.search(r"inet ([0-9.]+)", addr_output)
            if ip_match:
                info["local_ip"] = ip_match.group(1)

            # 게이트웨이 (P-t-P 연결의 원격지 주소, 예: "... peer 10.8.0.1/24 ...")
            gateway_match = re.search(r"peer ([0-9.]+)", addr_output)
            if gateway_match:
                info["gateway"] = gateway_match.group(1)

            # 3. 'ip route show' 명령으로 VPN 관련 라우트 정보 파싱
            route_output = subprocess.check_output(f"ip route show dev {tun_interface}", shell=True, text=True)
            info["routes"] = [line.strip() for line in route_output.strip().split('\n') if line.strip()]

            # 4. /etc/resolv.conf 파일에서 DNS 정보 파싱
            # 참고: 이 방법은 OpenVPN 서버가 DNS를 푸시했더라도, 클라이언트 시스템이
            # 이를 resolv.conf에 자동으로 반영하도록 설정되지 않으면 VPN의 DNS를 정확히 반영하지 못할 수 있습니다.
            if os.path.exists("/etc/resolv.conf"):
                with open("/etc/resolv.conf", "r") as f:
                    dns_servers = re.findall(r"nameserver\s+([0-9.]+)", f.read())
                    info["dns"] = dns_servers

        except subprocess.CalledProcessError as e:
            logger.error(f"ip 명령어 실행 오류: {e}")
        except Exception as e:
            logger.error(f"Linux 연결 정보 파싱 오류: {e}")

    def _is_openvpn_installed(self) -> bool:
        """OpenVPN이 설치되어 있는지 확인"""
        return self._get_openvpn_path() is not None
            
    def _install_openvpn(self) -> bool:
        """Docker 환경에서 OpenVPN 설치 시도"""
        try:
            # 패키지 업데이트 및 OpenVPN 설치 시도
            logger.info("OpenVPN 설치 시도 중...")
            
            # 현재 환경 확인 (Debian/Ubuntu vs Alpine)
            if os.path.exists("/etc/debian_version"):
                # Debian 기반 (Ubuntu, Debian)
                logger.info("Debian/Ubuntu 기반 환경 감지")
                update_cmd = subprocess.run(['apt-get', 'update', '-y'], 
                                           stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE,
                                           text=True)
                logger.info(f"apt-get update 결과: {update_cmd.returncode}")
                
                install_cmd = subprocess.run(['apt-get', 'install', '-y', 'openvpn'], 
                                           stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE,
                                           text=True)
                logger.info(f"OpenVPN 설치 결과: {install_cmd.returncode}")
                
            elif os.path.exists("/etc/alpine-release"):
                # Alpine
                logger.info("Alpine 기반 환경 감지")
                install_cmd = subprocess.run(['apk', 'add', 'openvpn'], 
                                           stdout=subprocess.PIPE,
                                           stderr=subprocess.PIPE,
                                           text=True)
                logger.info(f"OpenVPN 설치 결과: {install_cmd.returncode}")
                
            else:
                # 기타 환경
                logger.warning("알 수 없는 Linux 배포판. 패키지 관리자를 판단할 수 없습니다.")
                return False
                
            # 설치 확인
            return self._is_openvpn_installed()
            
        except Exception as e:
            logger.error(f"OpenVPN 설치 중 오류 발생: {str(e)}")
            return False

    # ===================================================================
    # Profile & Directory Management
    # ===================================================================

    def _ensure_config_dir_exists(self):
        """기본 설정 디렉토리와 각 프로필별 설정 디렉토리 생성"""
        # 기본 설정 디렉토리
        os.makedirs(self.base_config_dir, exist_ok=True)
        logger.info(f"VPN 기본 설정 디렉토리 확인: {self.base_config_dir}")
        
        # 프로필별 설정 디렉토리 (스토리지 매니저가 있는 경우)
        if self.storage_manager:
            try:
                logger.info("스토리지 매니저에서 프로필 목록 가져오는 중...")
                profiles = self.storage_manager.get_profiles()
                logger.info(f"가져온 프로필 목록: {profiles}")
                
                for profile in profiles:
                    profile_vpn_dir = os.path.join(self.base_config_dir, profile)
                    logger.info(f"프로필 VPN 디렉토리 생성/확인: {profile_vpn_dir}")
                    os.makedirs(profile_vpn_dir, exist_ok=True)
            except Exception as e:
                logger.error(f"프로필 디렉토리 생성 중 오류: {str(e)}")
                # 기본 프로필 디렉토리라도 생성
                os.makedirs(os.path.join(self.base_config_dir, "default"), exist_ok=True)
    
    def get_profile_vpn_dir(self, profile_name=None):
        """프로필별 VPN 설정 디렉토리 경로 반환"""
        # 스토리지 매니저가 없으면 기본 디렉토리 사용
        if not self.storage_manager:
            logger.warning("스토리지 매니저가 설정되지 않음: 기본 디렉토리 사용")
            return self.base_config_dir
            
        # 프로필 이름이 지정되지 않은 경우 현재 프로필 사용
        if profile_name is None:
            try:
                profile_name = self.storage_manager.get_current_profile()
                logger.info(f"현재 프로필 조회: {profile_name}")
            except Exception as e:
                logger.error(f"현재 프로필 조회 오류: {str(e)}")
                profile_name = "default"
                logger.info(f"기본 프로필 사용: {profile_name}")
        
        # 유효한 프로필인지 확인
        try:
            available_profiles = self.storage_manager.get_profiles()
            logger.info(f"사용 가능한 프로필 목록: {available_profiles}")
            
            # 유효하지 않은 프로필이면 기본값 사용
            if profile_name not in available_profiles:
                logger.warning(f"프로필 '{profile_name}'이 유효하지 않음, 기본 프로필 사용")
                profile_name = "default"
        except Exception as e:
            logger.error(f"프로필 목록 조회 오류: {str(e)}")
            # 오류가 발생하면 기본값 사용
            profile_name = "default"
        
        # 프로필 디렉토리 경로 생성 및 확인
        profile_dir = os.path.join(self.base_config_dir, profile_name)
        logger.info(f"프로필 디렉토리 경로: {profile_dir}")
        
        # 디렉토리 없으면 생성
        if not os.path.exists(profile_dir):
            logger.info(f"프로필 디렉토리 생성: {profile_dir}")
            os.makedirs(profile_dir, exist_ok=True)
        
        return profile_dir


# ----------------------- 사용 예시 -----------------------
if __name__ == "__main__":
    # 이 클래스는 단독으로 실행하기보다 다른 모듈에서 임포트하여 사용하는 것을 권장합니다.
    # 예: mgr = VPNManager(config_dir="path/to/vpn/configs")
    # print(mgr.list_configs())
    pass
