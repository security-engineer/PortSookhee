#!/usr/bin/env python3
# scanner.py
# ────────────────────────────────────────────────────────────────────────────
# python-nmap 기반 네트워크 스캐너
#  • Linux  : root → raw(SYN) 스캔(-sS) / 비-root → --unprivileged + -sT 로 자동 강제
#  • Windows: 항상 --unprivileged 강제(가상 NIC 이슈 회피)
#  • 기본 스캔 옵션: -sC -sV -sS   (표준 NSE 스크립트 + 버전 탐지 + SYN 스캔)
# ────────────────────────────────────────────────────────────────────────────

import json
import os
import shutil
import subprocess
import re
from typing import Any, Dict, List, Optional

import nmap


class NetworkScanner:
    def __init__(self) -> None:
        # nmap 바이너리 존재 여부 확인
        if not shutil.which("nmap"):
            raise RuntimeError(
                "nmap 실행 파일이 없습니다. apt install nmap (또는 apk/yum) 후 다시 실행하세요."
            )

        self.scanner = nmap.PortScanner()
        # Linux 에서 현재 사용자가 root 인지 확인
        self.is_root = os.name != "nt" and hasattr(os, "geteuid") and os.geteuid() == 0
        
        # Vulners와 Vulscan 스크립트 설치 여부 확인
        self.has_vulners = self._check_script_exists("vulners")
        self.has_vulscan = self._check_script_exists("vulscan/vulscan.nse")
        
        if not (self.has_vulners and self.has_vulscan):
            print("주의: 취약점 스크립트가 설치되지 않았습니다. 정확한 CVE 탐지를 위해 설치를 권장합니다.")
            print("설치 방법:")
            print("1. Vulners: git clone https://github.com/vulnersCom/nmap-vulners.git")
            print("2. Vulscan: git clone https://github.com/scipag/vulscan.git")
            print("3. nmap --script-updatedb 실행")
        else:
            print(f"취약점 스크립트 상태: Vulners({'설치됨' if self.has_vulners else '미설치'}), "
                  f"Vulscan({'설치됨' if self.has_vulscan else '미설치'})")

    def _check_script_exists(self, script_name: str) -> bool:
        """특정 nmap 스크립트가 설치되어 있는지 확인"""
        # 1. 파일 시스템에서 직접 확인
        script_path = ""
        if script_name == "vulners":
            script_path = "/usr/share/nmap/scripts/vulners.nse"
        elif script_name == "vulscan/vulscan.nse":
            script_path = "/usr/share/nmap/scripts/vulscan/vulscan.nse"
        
        if script_path and os.path.exists(script_path):
            print(f"스크립트 파일 확인됨: {script_path}")
            return True
            
        # 2. nmap --script-help 명령어로 확인
        try:
            print(f"스크립트 도움말 확인 중: {script_name}")
            result = subprocess.run(
                ["nmap", "--script-help", script_name], 
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                text=True,
                check=False
            )
            script_exists = "NSE" in result.stdout and "ERROR" not in result.stderr
            if script_exists:
                print(f"스크립트 도움말 확인됨: {script_name}")
            else:
                print(f"스크립트 도움말 확인 실패: {script_name}")
                if result.stderr:
                    print(f"오류: {result.stderr}")
            return script_exists
        except Exception as e:
            print(f"스크립트 확인 오류: {e}")
            return False

    # ────────────────────────────────────────────────────────────────────
    def scan_target(
        self,
        target: str,
        ports: str = "1-1000",
        arguments: str = "-sC -sV -sS",
    ) -> Dict[str, Any]:
        """
        대상 스캔 수행.

        Args:
            target   : IP / 호스트
            ports    : 포트 범위(빈 문자열 → 1-1000)
            arguments: nmap 추가 인자(기본 -sC -sV -sS)

        Returns:
            스캔 결과 dict (error 포함 가능)
        """
        try:
            if not ports or ports.strip() == "":
                ports = "1-1000"

            # ── Linux 비-root → --unprivileged + -sT (raw 스캔 불가) ──
            if os.name != "nt" and not self.is_root:
                if "--unprivileged" not in arguments:
                    arguments += " --unprivileged"
                if "-sS" in arguments:
                    arguments = arguments.replace("-sS", "-sT")
                if "-sU" in arguments:
                    arguments = arguments.replace("-sU", "-sT")
                print("비-root 리눅스 사용자: -sT + --unprivileged 로 변경")

            # ── Windows → 항상 --unprivileged 강제 ──
            if os.name == "nt" and "--unprivileged" not in arguments:
                arguments += " --unprivileged"
                print("Windows 환경: --unprivileged 옵션 추가")

            cmd_preview = f"nmap {arguments} -p {ports} {target}"
            print("실행 명령:", cmd_preview)

            # python-nmap 호출
            self.scanner.scan(target, ports, arguments, timeout=90)

            print("nmap 실제 명령:", self.scanner.command_line())
            
            # 디버깅: 스캔 결과 원시 데이터 출력
            print("-------- nmap 스캔 결과 디버깅 시작 --------")
            print(f"호스트 목록: {self.scanner.all_hosts()}")
            
            if self.scanner.all_hosts():
                for host in self.scanner.all_hosts():
                    print(f"호스트 {host} 정보:")
                    print(f"  상태: {self.scanner[host].state()}")
                    print(f"  사용 가능한 프로토콜: {self.scanner[host].all_protocols()}")
                    
                    for proto in self.scanner[host].all_protocols():
                        print(f"  {proto} 포트: {list(self.scanner[host][proto].keys())}")
            else:
                print("스캔 결과: 호스트 정보 없음")
                
            print("-------- nmap 스캔 결과 디버깅 끝 --------")
            
            # 취약점 스크립트가 결과에 포함되어 있지 않고, 스크립트가 설치되어 있다면
            # 별도로 취약점 스캔 수행
            scan_results = self._parse_scan_results(target)
            
            if self._needs_vuln_scan(scan_results) and (self.has_vulners or self.has_vulscan):
                print("취약점 스크립트로 추가 스캔 수행 중...")
                vuln_results = self._perform_vuln_scan(target, scan_results)
                return vuln_results
                
            return scan_results

        except Exception as exc:
            print("스캔 오류:", exc)
            print("스캔 오류 상세:", str(type(exc)), exc.__traceback__)
            import traceback
            traceback.print_exc()
            return {"error": str(exc)}

    def _needs_vuln_scan(self, scan_results: Dict[str, Any]) -> bool:
        """취약점 스캔이 필요한지 확인 (기존 스캔에 취약점 정보가 없는 경우)"""
        for host in scan_results.get("hosts", []):
            for port in host.get("ports", []):
                if port.get("vulnerabilities"):
                    return False  # 이미 취약점 정보가 있으면 스킵
        return True

    def _perform_vuln_scan(self, target: str, original_results: Dict[str, Any]) -> Dict[str, Any]:
        """취약점 스크립트를 사용하여 추가 스캔 수행"""
        vuln_scripts = []
        if self.has_vulners:
            vuln_scripts.append("vulners")
        if self.has_vulscan:
            vuln_scripts.append("vulscan/vulscan.nse")
            
        if not vuln_scripts:
            return original_results
            
        # 오픈된 포트 목록만 추출
        open_ports = []
        for host in original_results.get("hosts", []):
            for port in host.get("ports", []):
                if port.get("state") == "open":
                    open_ports.append(str(port.get("port")))
        
        if not open_ports:
            return original_results  # 열린 포트가 없으면 취약점 스캔 불필요
            
        ports_str = ",".join(open_ports)
        script_args = ",".join(vuln_scripts)
        
        try:
            # 취약점 스크립트만으로 추가 스캔 수행
            self.scanner.scan(target, ports_str, f"-sV --script={script_args}", timeout=120)
            
            # 원본 결과에 취약점 정보 병합
            vuln_results = original_results
            
            for host in self.scanner.all_hosts():
                for i, host_data in enumerate(vuln_results.get("hosts", [])):
                    if host_data.get("host") == host:
                        for proto in self.scanner[host].all_protocols():
                            for port, port_info in self.scanner[host][proto].items():
                                # 해당 포트 정보 찾기
                                for j, port_data in enumerate(host_data.get("ports", [])):
                                    if str(port_data.get("port")) == str(port):
                                        # 취약점 정보 추출 및 추가
                                        if "script" in port_info:
                                            vulnerabilities = self._parse_vulnerability_data(port_info["script"])
                                            if vulnerabilities:
                                                vuln_results["hosts"][i]["ports"][j]["vulnerabilities"] = vulnerabilities
            
            return vuln_results
                                        
        except Exception as e:
            print(f"취약점 스캔 오류: {e}")
            return original_results

    def _parse_vulnerability_data(self, script_data: Dict[str, str]) -> List[Dict[str, Any]]:
        """Vulners 또는 Vulscan 스크립트 결과에서 취약점 정보 추출"""
        vulnerabilities = []
        
        # Vulners 스크립트 결과 파싱
        if "vulners" in script_data:
            vulners_output = script_data["vulners"]
            # CVE-XXXX-XXXX 형식과 CVSS 점수 추출
            cve_matches = re.findall(r'(CVE-\d{4}-\d+).*?(\d+\.\d+)', vulners_output)
            for cve_id, cvss_score in cve_matches:
                vuln = {
                    "cve_id": cve_id,
                    "cvss_score": float(cvss_score),
                    "title": f"{cve_id} 취약점",
                    "description": "Vulners 데이터베이스에서 발견된 취약점",
                    "source": "vulners"
                }
                vulnerabilities.append(vuln)
        
        # Vulscan 스크립트 결과 파싱
        if "vulscan" in script_data:
            vulscan_output = script_data["vulscan"]
            # Vulscan은 여러 데이터베이스를 참조하므로 다른 형식으로 파싱
            cve_matches = re.findall(r'(CVE-\d{4}-\d+).*?(\d+\.\d+)?', vulscan_output)
            for cve_id, cvss_score in cve_matches:
                # CVSS 점수가 없는 경우 기본값 설정
                score = float(cvss_score) if cvss_score else 0.0
                
                # 중복 취약점 확인
                is_duplicate = any(v["cve_id"] == cve_id for v in vulnerabilities)
                if not is_duplicate:
                    vuln = {
                        "cve_id": cve_id,
                        "cvss_score": score,
                        "title": f"{cve_id} 취약점",
                        "description": "Vulscan 데이터베이스에서 발견된 취약점",
                        "source": "vulscan"
                    }
                    vulnerabilities.append(vuln)
        
        return vulnerabilities

    # ────────────────────────────────────────────────────────────────────
    def _parse_scan_results(self, target: str) -> Dict[str, Any]:
        """
        python-nmap 결과 구조를 JSON 직렬화하기 좋은 dict 로 변환
        (hostscript / 포트별 script 결과 포함)
        """
        results: Dict[str, Any] = {"target": target, "hosts": []}

        for host in self.scanner.all_hosts():
            hobj = self.scanner[host]

            host_block: Dict[str, Any] = {
                "host": host,
                "state": hobj.state(),
                "os": self._get_os_info(host),
                "hostscript": [],  # ★ host-level NSE 결과
                "ports": [],
            }

            # ── host-level NSE 스크립트 결과 ───────────────────────
            if "hostscript" in hobj:
                for script in hobj["hostscript"]:
                    host_block["hostscript"].append(
                        {"id": script.get("id"), "output": script.get("output")}
                    )

            # ── TCP 포트 결과 ─────────────────────────────────────
            if "tcp" in hobj:
                for port, pinfo in hobj["tcp"].items():
                    port_block: Dict[str, Any] = {
                        "port": port,
                        "state": pinfo["state"],
                        "service": pinfo["name"],
                        "product": pinfo.get("product", ""),
                        "version": pinfo.get("version", ""),
                        "extrainfo": pinfo.get("extrainfo", ""),
                        "scripts": [],  # ★ 포트-level NSE 결과
                    }

                    if "script" in pinfo:
                        for sid, soutput in pinfo["script"].items():
                            port_block["scripts"].append(
                                {"id": sid, "output": soutput}
                            )
                            
                        # 스크립트 결과에서 취약점 정보 추출
                        vulnerabilities = self._parse_vulnerability_data(pinfo["script"])
                        if vulnerabilities:
                            port_block["vulnerabilities"] = vulnerabilities

                    host_block["ports"].append(port_block)

            results["hosts"].append(host_block)

        return results

    # ────────────────────────────────────────────────────────────────────
    def _get_os_info(self, host: str) -> Dict[str, str]:
        default = {"name": "Unknown", "accuracy": "0"}
        if "osmatch" in self.scanner[host] and self.scanner[host]["osmatch"]:
            m = self.scanner[host]["osmatch"][0]
            return {
                "name": m.get("name", "Unknown"),
                "accuracy": m.get("accuracy", "0"),
            }
        return default

    # ────────────────────────────────────────────────────────────────────
    def check_vulns(self, scan_results: Dict[str, Any]) -> Dict[str, Any]:
        """
        스캔 결과에 취약점 정보가 없는 경우, 취약점 스크립트로 추가 스캔 수행
        이미 취약점 정보가 있으면 그대로 반환
        """
        if self._needs_vuln_scan(scan_results) and (self.has_vulners or self.has_vulscan):
            # 취약점 정보가 필요하고 스크립트가 설치되어 있으면 추가 스캔
            target = scan_results.get("target", "")
            if target:
                return self._perform_vuln_scan(target, scan_results)
        
        return scan_results


# ───────────────────────────── 테스트 ──────────────────────────────
if __name__ == "__main__":
    scanner = NetworkScanner()
    result = scanner.scan_target("scanme.nmap.org", ports="22,80,443")
    print(json.dumps(result, indent=2, ensure_ascii=False))
