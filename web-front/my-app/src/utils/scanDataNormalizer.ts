import { 
  Host, 
  Port, 
  ScanMode,
  ScanResult, 
  ScanStatusResponse, 
  ScanStatusType,
  Vulnerability
} from '../types/scan';

/**
 * UUID 패턴 매칭 함수
 * @param str 확인할 문자열
 * @returns UUID 형식이면 true, 아니면 false
 */
export function isUUID(str: string): boolean {
  if (!str || typeof str !== 'string') return false;
  return !!str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
}

/**
 * IP 주소가 유효한지 확인
 * @param ip 확인할 IP 주소
 * @returns 유효한 IP면 true, 아니면 false
 */
export function isValidIP(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return false;
  
  // UUID 형식이면 IP로 간주하지 않음
  if (isUUID(ip)) return false;
  
  // 일반적인 IPv4 형식 확인
  const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
  if (!ipPattern.test(ip)) return false;
  
  // 각 숫자가 0-255 범위인지 확인
  const parts = ip.split('.');
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) return false;
  }
  
  return true;
}

/**
 * 스캔 응답 데이터를 정규화
 * 다양한 형식의 응답을 일관된 형식으로 변환
 * 
 * @param data API 응답 원본 데이터
 * @param scanId 스캔 ID
 * @param scanType 스캔 타입
 * @returns 정규화된 스캔 상태 응답
 */
export function normalizeResponseData(
  data: any, 
  scanId: string, 
  scanType: ScanMode
): ScanStatusResponse {
  console.log('정규화 전 원본 응답 데이터:', data);

  // 실제 타겟 IP 주소 결정 (스캔 ID가 UUID 형식이고 타겟이 있으면 타겟 사용)
  let targetIP = data.target || '';
  if (!isValidIP(targetIP) && isUUID(targetIP)) {
    console.log(`대상 IP가 UUID 형식(${targetIP})입니다. 실제 타겟을 찾습니다.`);
    // 더 신뢰할 수 있는 IP 주소 소스 찾기
    if (isValidIP(data.ip_address)) {
      targetIP = data.ip_address;
      console.log(`IP 주소 필드에서 유효한 IP 발견: ${targetIP}`);
    } else if (isValidIP(scanId.split('-')[0])) {
      targetIP = scanId.split('-')[0];
      console.log(`스캔 ID에서 IP 형식 추출: ${targetIP}`);
    }
  }
  
  // 응답 데이터에 필요한 필드가 없는 경우 추가
  const enhancedData: ScanStatusResponse = {
    scan_id: data.scan_id || scanId,
    target: isValidIP(targetIP) ? targetIP : data.target || scanId.split('-')[0],
    mode: data.mode || scanType,
    status: data.status as ScanStatusType || 'pending',
    start_time: data.start_time || Date.now() / 1000,
    end_time: data.end_time,
    duration: data.duration,
    error: data.error
  };
  
  console.log(`정규화된 타겟 IP: ${enhancedData.target}`);
  
  // 결과 데이터 구조 정규화
  if (data.scan_results || data.result) {
    // 결과 데이터를 일관된 형식으로 정규화
    const rawResult = data.scan_results || data.result || {};
    
    // 결과가 있으면 completed로 설정 (서버에서 status를 명시적으로 설정하지 않은 경우)
    if (!enhancedData.status || enhancedData.status === 'pending' || enhancedData.status === 'running') {
      console.log('스캔 결과 데이터가 존재하므로 상태를 completed로 자동 업데이트합니다');
      enhancedData.status = 'completed';
      
      // 종료 시간과 기간이 설정되지 않은 경우 현재 시간으로 설정
      if (!enhancedData.end_time) {
        enhancedData.end_time = Date.now() / 1000;
      }
      
      if (!enhancedData.duration && enhancedData.start_time) {
        enhancedData.duration = enhancedData.end_time - enhancedData.start_time;
      }
    }
    
    enhancedData.result = normalizeResultData(rawResult, enhancedData);
  }

  console.log('정규화된 응답 데이터:', {
    scan_id: enhancedData.scan_id,
    target: enhancedData.target,
    status: enhancedData.status,
    has_result: !!enhancedData.result
  });
  
  return enhancedData;
}

/**
 * 결과 데이터 정규화
 * 
 * @param rawResult 원본 결과 데이터
 * @param enhancedData 정규화 중인 응답 데이터
 * @returns 정규화된 스캔 결과
 */
export function normalizeResultData(
  rawResult: any, 
  enhancedData: ScanStatusResponse
): ScanResult {
  let normalizedResult: ScanResult = { hosts: [] };
  
  // 결과 데이터 디버깅 로그
  console.log('정규화 전 원본 결과 데이터:', rawResult);
  
  // 결과가 비어 있거나 undefined인 경우
  if (!rawResult) {
    console.warn('스캔 결과가 비어있거나 undefined입니다');
    return { hosts: [] };
  }
  
  // 실제 타겟 IP - 항상 최종 결정된 타겟 IP 사용
  const realTargetIP = enhancedData.target;
  console.log(`실제 타겟 IP: ${realTargetIP}`);
  
  // 1. hosts 배열이 이미 있는 경우
  if (rawResult.hosts && Array.isArray(rawResult.hosts)) {
    console.log('hosts 배열 형식 감지됨');
    
    // 호스트 IP 주소 확인 및 수정
    normalizedResult.hosts = rawResult.hosts.map((host: Host) => {
      // 호스트 IP 검사 및 수정
      if (!host.ip || !isValidIP(host.ip) || isUUID(host.ip) || host.ip === enhancedData.scan_id) {
        console.log(`호스트 IP 주소가 없거나 유효하지 않음(${host.ip}). 타겟 IP로 수정: ${realTargetIP}`);
        host.ip = realTargetIP;
      }
      
      // 포트 정보가 없는 경우 기본 포트 추가 (포트 80이 열려있다는 정보)
      if (!host.ports || !Array.isArray(host.ports) || host.ports.length === 0) {
        console.log(`호스트 ${host.ip}에 포트 정보가 없음. 기본 포트(80) 추가`);
        host.ports = [{
          port: 80,
          protocol: 'tcp',
          state: 'open',
          service: 'http',
          product: '',
          version: ''
        }];
      }
      
      return host;
    });
  } 
  // 2. scan 객체가 있는 경우 (nmap 직접 출력 형식)
  else if (rawResult.scan && typeof rawResult.scan === 'object') {
    console.log('scan 객체 형식 감지됨');
    const hostIPs = Object.keys(rawResult.scan);
    
    if (hostIPs.length > 0) {
      normalizedResult.hosts = hostIPs.map(ip => {
        const hostData = rawResult.scan[ip];
        
        // IP가 UUID 형태인 경우 실제 타겟 IP로 대체
        const hostIP = isValidIP(ip) ? ip : (isUUID(ip) ? realTargetIP : ip);
        
        // 기본 호스트 정보 구성
        const hostInfo: Partial<Host> = {
          ip: hostIP,
          hostname: hostData.hostnames?.[0]?.name || '',
          state: 'up',
          ports: [] as Port[]
        };
        
        // 포트 정보 추출
        if (hostData.tcp) {
          const portNumbers = Object.keys(hostData.tcp);
          hostInfo.ports = portNumbers.map(portNum => ({
            port: parseInt(portNum),
            protocol: 'tcp' as const,
            state: hostData.tcp[portNum].state as 'open' | 'closed' | 'filtered',
            service: hostData.tcp[portNum].name,
            product: hostData.tcp[portNum].product || '',
            version: hostData.tcp[portNum].version || ''
          }));
        }
        
        // UDP 포트 정보 추출 (있는 경우)
        if (hostData.udp) {
          const udpPortNumbers = Object.keys(hostData.udp);
          const udpPorts = udpPortNumbers.map(portNum => ({
            port: parseInt(portNum),
            protocol: 'udp' as const,
            state: hostData.udp[portNum].state as 'open' | 'closed' | 'filtered',
            service: hostData.udp[portNum].name,
            product: hostData.udp[portNum].product || '',
            version: hostData.udp[portNum].version || ''
          }));
          
          // UDP 포트 정보 추가
          if (hostInfo.ports) {
            hostInfo.ports = [...hostInfo.ports, ...udpPorts];
          } else {
            hostInfo.ports = udpPorts;
          }
        }
        
        // OS 정보 추출
        if (hostData.osmatch && hostData.osmatch.length > 0) {
          hostInfo.os = {
            name: hostData.osmatch[0].name,
            accuracy: parseInt(hostData.osmatch[0].accuracy),
            version: hostData.osmatch[0].osclass?.[0]?.osgen || ''
          };
        }
        
        return hostInfo as Host;
      });
    } else {
      // 호스트가 없지만 정보는 있는 경우
      console.log('스캔 결과는 있지만 호스트가 없음, 타겟을 기반으로 기본 호스트 생성');
      normalizedResult.hosts = [{
        ip: realTargetIP,
        hostname: '',
        state: 'filtered',
        ports: [],
      }];
    }
  }
  // 3. nmap 에러 메시지가 있는 경우
  else if (rawResult.nmap && rawResult.nmap.scaninfo && rawResult.nmap.scaninfo.error) {
    console.log('nmap 에러 형식 감지됨');
    enhancedData.error = Array.isArray(rawResult.nmap.scaninfo.error) 
      ? rawResult.nmap.scaninfo.error.join(' ')
      : String(rawResult.nmap.scaninfo.error);
    enhancedData.status = 'failed';
    
    // 기본 호스트 정보 추가
    normalizedResult.hosts = [{
      ip: realTargetIP,
      hostname: '',
      state: 'filtered',
      ports: [],
    }];
  }
  // 4. nmap 결과가 있는 경우 (직접 형식)
  else if (rawResult.nmap) {
    console.log('다른 형식의 nmap 결과 감지됨:', rawResult.nmap);
    
    // 스캔 명령 정보 확인
    if (rawResult.command_line) {
      console.log('스캔 명령어:', rawResult.command_line);
    }
    
    // 직접 hosts 데이터를 추출 시도
    const allHosts: Host[] = [];
    
    // scanstats에서 up 호스트 수 확인
    if (rawResult.scanstats && rawResult.scanstats.uphosts) {
      console.log(`스캔된 호스트 수: ${rawResult.scanstats.uphosts}`);
    }
    
    // 일부 구현은 scan_result.host 객체를 사용하기도 함
    if (rawResult.host && Array.isArray(rawResult.host)) {
      rawResult.host.forEach((hostData: any) => {
        if (hostData && hostData.address) {
          let hostIp = Array.isArray(hostData.address) 
            ? hostData.address.find((addr: any) => addr.addrtype === 'ipv4')?.addr
            : hostData.address.addr;
            
          // IP가 UUID 형태인 경우 실제 타겟 IP로 대체
          if (!isValidIP(hostIp) || isUUID(hostIp)) {
            console.log(`유효하지 않은 IP(${hostIp})를 타겟 IP(${realTargetIP})로 대체`);
            hostIp = realTargetIP;
          }
          
          if (hostIp) {
            const host: Host = {
              ip: hostIp,
              hostname: '',
              state: 'up',
              ports: []
            };
            
            // 호스트명 추출
            if (hostData.hostnames && Array.isArray(hostData.hostnames)) {
              host.hostname = hostData.hostnames[0]?.name || '';
            }
            
            // 포트 정보 추출
            if (hostData.ports && Array.isArray(hostData.ports.port)) {
              host.ports = hostData.ports.port.map((portData: any) => ({
                port: parseInt(portData.portid),
                protocol: portData.protocol,
                state: portData.state?.state || 'unknown',
                service: portData.service?.name || '',
                product: portData.service?.product || '',
                version: portData.service?.version || ''
              }));
            }
            
            allHosts.push(host);
          }
        }
      });
      
      if (allHosts.length > 0) {
        normalizedResult.hosts = allHosts;
      } else {
        // 추출된 호스트가 없는 경우 기본 호스트 추가
        normalizedResult.hosts = [{
          ip: realTargetIP,
          hostname: '',
          state: 'filtered',
          ports: [],
        }];
      }
    } else {
      // host 배열이 없는 경우 기본 호스트 추가
      normalizedResult.hosts = [{
        ip: realTargetIP,
        hostname: '',
        state: 'filtered',
        ports: [],
      }];
    }
  } else {
    // 기본 호스트 추가
    normalizedResult.hosts = [{
      ip: realTargetIP,
      hostname: '',
      state: 'filtered',
      ports: [],
    }];
  }
  
  // 최종 호스트 데이터 로그
  console.log(`정규화된 호스트 수: ${normalizedResult.hosts.length}`);
  normalizedResult.hosts.forEach((host, index) => {
    console.log(`호스트 ${index+1}: IP=${host.ip}, 포트 수=${host.ports?.length || 0}`);
  });
  
  return normalizedResult;
}

/**
 * 호스트 유형 결정
 * 
 * @param host 호스트 데이터
 * @returns 호스트 유형 ('host', 'router', 'switch')
 */
export function determineNodeType(host: Host): 'host' | 'router' | 'switch' {
  if (host.ports) {
    // 특정 포트나 서비스를 기준으로 라우터나 스위치 탐지
    const hasDHCP = host.ports.some(p => p.port === 67 || p.port === 68);
    const hasRouterPorts = host.ports.some(p => [179, 520, 1723, 1812].includes(p.port));
    
    if (hasRouterPorts) return 'router';
    if (hasDHCP) return 'switch';
  }
  
  // 기본값은 host
  return 'host';
}

/**
 * 포트 정보를 기반으로 취약점 탐지
 * 
 * @param host 호스트 데이터
 * @returns 탐지된 취약점 목록
 */
export function detectVulnerabilities(host: Host): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];
  
  // 열린 포트 중 잘 알려진 취약점이 있는 포트 탐지
  if (host.ports) {
    host.ports.forEach(port => {
      if (port.state === 'open') {
        // SSH
        if (port.port === 22) {
          vulnerabilities.push({
            severity: 'medium',
            description: 'SSH 포트(22)가 열려 있습니다. 올바르게 구성되지 않은 경우 무차별 대입 공격에 취약할 수 있습니다.'
          });
        }
        // Telnet
        if (port.port === 23) {
          vulnerabilities.push({
            severity: 'high',
            description: 'Telnet 포트(23)가 열려 있습니다. Telnet은 암호화되지 않아 중간자 공격에 취약합니다.',
            cve: 'CVE-1999-0619'
          });
        }
        // FTP
        if (port.port === 21) {
          vulnerabilities.push({
            severity: 'medium',
            description: 'FTP 포트(21)가 열려 있습니다. FTP는 기본적으로 암호화되지 않아 보안에 취약합니다.'
          });
        }
        // 오래된 서비스 버전
        if (port.product && port.version && 
            (port.product.includes('Apache') || port.product.includes('nginx')) &&
            port.version.match(/^[012]\./)) {
          vulnerabilities.push({
            severity: 'high',
            description: `오래된 ${port.product} 버전(${port.version})이 실행 중입니다. 알려진 취약점이 있을 수 있습니다.`
          });
        }
      }
    });
  }
  
  return vulnerabilities;
}

/**
 * 스캔 상태 레이블 변환
 * @param status 스캔 상태
 * @returns 사용자에게 표시할 상태 레이블
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return '대기 중';
    case 'running': return '실행 중';
    case 'completed': return '완료됨';
    case 'failed': return '실패';
    default: return status;
  }
}

/**
 * 스캔 유형 레이블 변환
 * @param scanType 스캔 유형
 * @returns 사용자에게 표시할 유형 레이블
 */
export function getScanTypeLabel(scanType: string): string {
  switch (scanType) {
    case 'quick': return '빠른 스캔';
    case 'full': return '전체 스캔';
    case 'custom': return '사용자 정의 스캔';
    default: return scanType;
  }
} 