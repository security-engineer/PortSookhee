import { useState, useEffect, useCallback } from 'react';
import { scanService } from '../services/scanService';
import { 
  normalizeResponseData,
  normalizeResultData, 
  detectVulnerabilities,
  determineNodeType,
  isUUID,
  isValidIP
} from '../utils/scanDataNormalizer';
import { 
  ScanMode, 
  ScanData, 
  ScanStatusResponse,
  ScanResult,
  Host,
  ScanStatusType
} from '../types/scan';
import { NodeData } from '../components/topology/Topology';

interface UseScanProps {
  onScanComplete?: (results: ScanResult) => void;
  onNodeSelect?: (node: NodeData | null) => void;
}

interface UseScanState {
  target: string;
  scanType: ScanMode;
  ports: string;
  customArguments: string;
  options: {
    osDetection: boolean;
    serviceVersion: boolean;
    scriptScan: boolean;
  };
  isLoading: boolean;
  error: string;
  scanId: string | null;
  scanStatus: ScanStatusResponse | null;
  serverAvailable: boolean;
  pollingInterval: NodeJS.Timeout | null;
}

export function useScan({ onScanComplete, onNodeSelect }: UseScanProps = {}) {
  const [state, setState] = useState<UseScanState>({
    target: '',
    scanType: 'quick',
    ports: '',
    customArguments: '',
    options: {
      osDetection: false,
      serviceVersion: false,
      scriptScan: false,
    },
    isLoading: false,
    error: '',
    scanId: null,
    scanStatus: null,
    serverAvailable: true,
    pollingInterval: null
  });

  // 상태 업데이트 헬퍼 함수
  const updateState = useCallback((newState: Partial<UseScanState>) => {
    setState(prevState => ({ ...prevState, ...newState }));
  }, []);

  // 서버 상태 확인
  const checkServerStatus = useCallback(async () => {
    try {
      console.log('서버 상태 확인 중...');
      const isAvailable = await scanService.checkServerStatus();
      updateState({ serverAvailable: isAvailable });
      
      if (!isAvailable) {
        updateState({ 
          error: '백엔드 서버에 연결할 수 없습니다. 서버 상태를 확인하거나 나중에 다시 시도해주세요.',
          isLoading: false
        });
        console.error('백엔드 서버 연결 실패');
      } else {
        // 서버 연결이 복구되면 오류 메시지 초기화
        if (state.error && state.error.includes('백엔드 서버에 연결할 수 없습니다')) {
          updateState({ error: '' });
          console.log('백엔드 서버 연결 복구됨');
        }
      }
      
      return isAvailable;
    } catch (error) {
      console.error('서버 상태 확인 중 오류 발생:', error);
      updateState({ 
        serverAvailable: false, 
        error: '백엔드 서버 상태 확인 중 오류가 발생했습니다.',
        isLoading: false 
      });
      return false;
    }
  }, [state.error, updateState]);

  // 토폴로지에 호스트 추가 - 먼저 정의
  const addHostToTopology = useCallback((host: Host) => {
    if (!onNodeSelect) return;
    
    console.log('토폴로지에 호스트 추가 시도:', host);
    
    // 실제 IP 주소 확인
    let hostIp = host.ip;
    let originalIp = hostIp; // 원본 IP 저장 (로깅용)
    
    // IP 유효성 검증 및 UUID 확인 (util 함수 사용)
    const isUUIDPattern = isUUID(hostIp);
    const isValidIPPattern = isValidIP(hostIp);
    
    if (!isValidIPPattern || isUUIDPattern) {
      console.error(`유효하지 않은 IP 주소 감지: ${hostIp} (UUID: ${isUUIDPattern}, 유효한 IP: ${isValidIPPattern})`);
      
      // 실제 스캔 대상 IP 사용
      if (state.target && isValidIP(state.target)) {
        console.log(`UUID 또는 유효하지 않은 IP를 스캔 대상(${state.target})으로 대체합니다.`);
        host.ip = state.target;
        hostIp = state.target;
      } 
      // 스캔 상태에서 타겟 확인
      else if (state.scanStatus && state.scanStatus.target && isValidIP(state.scanStatus.target)) {
        console.log(`UUID 또는 유효하지 않은 IP를 스캔 상태의 타겟(${state.scanStatus.target})으로 대체합니다.`);
        host.ip = state.scanStatus.target;
        hostIp = state.scanStatus.target;
      }
      else {
        console.error('유효한 IP 주소를 찾을 수 없습니다. 노드를 추가할 수 없습니다.');
        return;
      }
    }
    
    console.log(`노드 생성 - 원본 IP: ${originalIp}, 사용 IP: ${hostIp}`);
    
    // NodeData 형식으로 변환
    const nodeData: NodeData = {
      id: `host-${hostIp.replace(/\./g, '-')}`,  // IP 주소 기반으로 ID 생성
      type: determineNodeType(host),
      name: hostIp, // 이름을 IP 주소로 설정
      ip: hostIp,
      nmapData: host,
    };
    
    console.log('생성된 노드 데이터:', nodeData);

    // 취약점 정보 추가 (있는 경우)
    if (host.ports && host.ports.length > 0) {
      const vulnerabilities = detectVulnerabilities(host);
      if (vulnerabilities.length > 0) {
        nodeData.vulnerabilities = vulnerabilities;
      }
    }
    
    // localStorage에 노드 추가
    try {
      const existingNodesJson = localStorage.getItem('topologyNodes') || '[]';
      const existingNodes = JSON.parse(existingNodesJson);
      
      const nodeExists = existingNodes.some((node: any) => node.id === nodeData.id);
      
      if (!nodeExists) {
        existingNodes.push(nodeData);
        localStorage.setItem('topologyNodes', JSON.stringify(existingNodes));
        console.log('토폴로지 노드가 저장됨:', nodeData);
        
        // 커스텀 이벤트 발생시켜 토폴로지 업데이트
        window.dispatchEvent(new CustomEvent('topologyNodeAdded', { 
          detail: { node: nodeData } 
        }));
        
        // 노드 선택
        onNodeSelect(nodeData);
        
        // 성공 메시지
        const messageDiv = document.createElement('div');
        messageDiv.className = 'topology-message';
        messageDiv.textContent = `${nodeData.name} 노드가 토폴로지에 추가되었습니다.`;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
          messageDiv.remove();
        }, 3000);
      } else {
        console.log(`${nodeData.name}는 이미 토폴로지에 존재합니다`);
      }
    } catch (error) {
      console.error('토폴로지 노드 저장 중 오류:', error);
    }
  }, [onNodeSelect, state.target, state.scanStatus]);

  // 완료된 스캔 처리 - addHostToTopology 다음에 정의
  const handleCompletedScan = useCallback((scanData: ScanStatusResponse) => {
    console.log('스캔 결과 감지됨. 결과 처리 중...', scanData);
    
    // 결과가 있는 경우 자동으로 토폴로지에 호스트 추가
    if (scanData.result?.hosts && Array.isArray(scanData.result.hosts) && scanData.result.hosts.length > 0) {
      console.log(`발견된 호스트 ${scanData.result.hosts.length}개를 토폴로지에 추가 시도...`);
      
      // 각 호스트 정보 수정
      scanData.result.hosts.forEach((host, index) => {
        console.log(`호스트 ${index+1} 원본 정보:`, {
          ip: host.ip,
          hostname: host.hostname,
          state: host.state,
          ports: host.ports?.length || 0
        });
        
        // IP 주소 검증 및 수정 (util 함수 사용)
        if (!isValidIP(host.ip) || isUUID(host.ip)) {
          const originalIp = host.ip;
          
          // 스캔 타겟 IP 사용
          if (scanData.target && isValidIP(scanData.target)) {
            console.log(`호스트 ${index+1}의 IP 주소(${originalIp})를 타겟 IP(${scanData.target})로 대체합니다.`);
            host.ip = scanData.target;
          } 
          // 상태의 타겟 IP 사용
          else if (state.target && isValidIP(state.target)) {
            console.log(`호스트 ${index+1}의 IP 주소(${originalIp})를 상태의 타겟 IP(${state.target})로 대체합니다.`);
            host.ip = state.target;
          }
          
          console.log(`호스트 ${index+1} IP 주소 변경됨: ${originalIp} → ${host.ip}`);
        }
      });
      
      // 첫 번째 호스트를 토폴로지에 자동으로 추가
      const firstHost = scanData.result.hosts[0];
      if (firstHost) {
        console.log('토폴로지에 추가할 호스트 발견:', firstHost.ip);
        addHostToTopology(firstHost);
      }
    } else {
      console.warn('결과에 유효한 호스트 데이터가 없습니다:', scanData.result);
    }
    
    if (onScanComplete && scanData.result) {
      onScanComplete(scanData.result);
    }
  }, [onScanComplete, addHostToTopology, state.target]);

  // 스캔 상태 가져오기 - handleCompletedScan 다음에 정의
  const fetchScanStatus = useCallback(async (id: string, force?: boolean) => {
    try {
      console.log(`스캔 상태 조회 중: ${id}`);
      
      // 타임아웃 설정
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('스캔 상태 조회 타임아웃')), 15000); // 15초로 증가
      });
      
      // 실제 API 호출과 타임아웃 경쟁
      const response = await Promise.race([
        scanService.getScanStatus(id),
        timeoutPromise
      ]) as ScanStatusResponse;
      
      // 데이터 처리 전 유효성 확인
      if (!response) {
        console.error('스캔 상태 응답에 데이터가 없습니다');
        return;
      }
      
      // 응답 데이터 정규화
      const enhancedData = normalizeResponseData(response, id, state.scanType);
      
      console.log('정규화된 스캔 데이터:', enhancedData);
      
      // 데이터를 상태로 설정
      updateState({ scanStatus: enhancedData });
      
      // 완료 또는 실패 시 폴링 중지 및 결과 처리
      if (['completed', 'failed'].includes(enhancedData.status) || force) {
        console.log(`스캔 ${id} ${enhancedData.status} 상태로 폴링 종료`);
        if (state.pollingInterval) {
          clearInterval(state.pollingInterval);
        }
        updateState({ pollingInterval: null, isLoading: false });
        
        // 성공적으로 스캔이 완료되었고 결과가 있을 경우
        if ((enhancedData.status === 'completed' || force) && enhancedData.result) {
          handleCompletedScan(enhancedData);
        }
      } else {
        console.log(`스캔 상태: ${enhancedData.status} - 폴링 계속`);
      }
    } catch (err: any) {
      console.error('스캔 상태 조회 실패:', err);
      
      // 서버 상태 확인
      const isAvailable = await scanService.checkServerStatus();
      updateState({ serverAvailable: isAvailable });
      
      if (!isAvailable || err.message === '스캔 상태 조회 타임아웃') {
        if (state.pollingInterval) {
          clearInterval(state.pollingInterval);
        }
        updateState({ 
          pollingInterval: null, 
          isLoading: false,
          error: err.message === '스캔 상태 조회 타임아웃' ? 
            '스캔 상태 조회 시간이 초과되었습니다. 스캔이 오래 걸리거나 서버 부하가 높을 수 있습니다.' : 
            '백엔드 서버와의 연결이 끊어졌습니다. 서버 상태를 확인해주세요.'
        });
      }
    }
  }, [state.pollingInterval, state.scanType, updateState, handleCompletedScan]);

  // 스캔 상태 폴링 - fetchScanStatus 다음에 정의
  const startPolling = useCallback((id: string) => {
    // 이전 폴링 인터벌이 있다면 정리
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
    }
    
    console.log(`스캔 ID ${id}에 대한 폴링 시작...`);
    
    // 폴링 시작 시간 기록
    const pollingStartTime = Date.now();
    // 최대 폴링 시간 (1분)
    const MAX_POLLING_TIME = 60 * 1000;
    
    // 즉시 한 번 상태 확인
    fetchScanStatus(id);
    
    // 새 폴링 인터벌 설정
    const newInterval = setInterval(() => {
      // 최대 시간을 초과하면 폴링 중단
      if (Date.now() - pollingStartTime > MAX_POLLING_TIME) {
        console.log(`최대 폴링 시간(${MAX_POLLING_TIME/1000}초)을 초과하여 폴링을 중단합니다.`);
        clearInterval(newInterval);
        
        // 스캔이 아직도 진행 중이면 결과를 강제로 확인하고 완료 처리
        if (state.isLoading && state.scanStatus && state.scanStatus.status !== 'completed') {
          console.log('스캔 시간이 너무 오래 걸려 강제로 완료 처리합니다.');
          
          // 기존 상태를 복제하고 상태를 완료로 변경
          const finalStatus = {
            ...state.scanStatus,
            status: 'completed' as ScanStatusType,
            end_time: Date.now() / 1000,
            duration: (Date.now() / 1000) - (state.scanStatus.start_time || Date.now() / 1000)
          };
          
          updateState({ 
            pollingInterval: null, 
            isLoading: false,
            scanStatus: finalStatus,
          });
          
          // 서버에 마지막으로 결과를 확인
          fetchScanStatus(id, true);
        }
        
        return;
      }
      
      fetchScanStatus(id);
    }, 2000); // 2초마다 폴링
    
    updateState({ pollingInterval: newInterval });
  }, [state.pollingInterval, state.isLoading, state.scanStatus, updateState, fetchScanStatus]);

  // 스캔 처리 함수 - startPolling 다음에 정의
  const startScan = useCallback(async (scanData: ScanData) => {
    try {
      updateState({ isLoading: true, error: '' });
      console.log('스캔 시작 요청:', scanData);
      
      // 서버 상태 확인
      console.log('스캔 전 서버 상태 확인 중...');
      const isServerAvailable = await checkServerStatus();
      if (!isServerAvailable) {
        console.error('서버 상태 확인 실패, 스캔 취소');
        updateState({ 
          isLoading: false,
          error: '백엔드 서버에 연결할 수 없어 스캔을 시작할 수 없습니다.'
        });
        return;
      }
      
      console.log('서버 상태 확인 성공, 스캔 요청 전송');
      
      // 스캔 요청
      const response = await scanService.startScan(scanData);
      console.log('스캔 요청 응답 받음:', response);
      
      if (response && response.scan_id) {
        updateState({ 
          scanId: response.scan_id,
          scanStatus: {
            scan_id: response.scan_id,
            target: response.target || scanData.target,
            mode: response.mode || scanData.mode,
            status: response.status || 'pending',
            start_time: response.start_time || Date.now() / 1000
          }
        });
        
        console.log(`스캔 ID ${response.scan_id}로 폴링 시작`);
        startPolling(response.scan_id);
      } else {
        throw new Error('서버 응답에 스캔 ID가 없습니다.');
      }
    } catch (err: any) {
      console.error('스캔 요청 실패:', err);
      
      // 에러 세부 정보에 따른 적절한 오류 메시지 표시
      if (err.response) {
        console.error('서버 오류 응답:', {
          status: err.response.status,
          statusText: err.response.statusText,
          data: err.response.data
        });
        
        // 상태 코드에 따른 구체적인 오류 메시지
        if (err.response.status === 401) {
          updateState({ 
            error: '인증 오류: 백엔드 서버에 접근할 수 없습니다. 관리자에게 문의하세요.',
            isLoading: false 
          });
        } else if (err.response.status === 403) {
          updateState({ 
            error: '권한 오류: 스캔 기능을 사용할 권한이 없습니다. 관리자에게 문의하세요.',
            isLoading: false 
          });
        } else if (err.response.status === 404) {
          updateState({ 
            error: '스캔 API를 찾을 수 없습니다. 백엔드 서버 설정을 확인하세요.',
            isLoading: false 
          });
        } else {
          updateState({ 
            error: err.response.data?.message || `서버 오류 (${err.response.status}): ${err.response.statusText}`,
            isLoading: false 
          });
        }
      } else if (err.request) {
        console.error('요청 후 응답 없음:', err.request);
        updateState({ 
          error: '서버에서 응답을 받지 못했습니다. 백엔드 서버나 네트워크 연결을 확인하세요.',
          isLoading: false,
          serverAvailable: false
        });
      } else {
        console.error('요청 구성 오류:', err.message);
        updateState({ 
          error: err.message || '알 수 없는 오류가 발생했습니다.',
          isLoading: false 
        });
      }
      
      // 서버 상태 다시 확인
      checkServerStatus();
    }
  }, [state, checkServerStatus, updateState, startPolling]);

  // 컴포넌트 마운트 시 서버 상태 확인
  useEffect(() => {
    console.log('스캔 컴포넌트 마운트, 서버 상태 확인 시작');
    
    // 즉시 서버 상태 확인
    checkServerStatus();
    
    // 20초마다 서버 상태 확인 (폴링)
    const serverCheckInterval = setInterval(checkServerStatus, 20000);
    
    return () => {
      console.log('스캔 컴포넌트 언마운트, 인터벌 정리');
      clearInterval(serverCheckInterval);
      if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 커스텀 스캔 인자 생성
  const buildScanArguments = useCallback((): string => {
    let args = '-sT'; // 기본 TCP 스캔
    
    if (state.options.osDetection) args += ' -O';
    if (state.options.serviceVersion) args += ' -sV';
    if (state.options.scriptScan) args += ' -sC';
    
    return args;
  }, [state.options]);
  
  // 새 스캔 시작 (리셋)
  const resetScan = useCallback(() => {
    updateState({
      scanId: null,
      scanStatus: null,
      isLoading: false,
    });
    
    if (state.pollingInterval) {
      clearInterval(state.pollingInterval);
      updateState({ pollingInterval: null });
    }
  }, [state.pollingInterval, updateState]);

  // 폼 제출 핸들러
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    updateState({ error: '', scanId: null, scanStatus: null });

    if (!state.target) {
      updateState({ error: '대상 주소를 입력해주세요.' });
      return;
    }
    
    // 타겟 형식 검증 (UUID처럼 보이면 경고 표시)
    if (state.target.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      updateState({ error: '대상이 IP 주소나 도메인이 아닌 것 같습니다. 올바른 주소를 입력해주세요.' });
      return;
    }
    
    // 사용자 정의 스캔 시 포트 또는 인자 필요
    if (state.scanType === 'custom' && !state.ports && !state.customArguments) {
      updateState({ error: '사용자 정의 스캔에는 포트 범위 또는 스캔 인자를 지정해야 합니다.' });
      return;
    }
    
    // API 요청 데이터 구성
    let scanData: ScanData;
    
    // 스캔 타입에 따른 데이터 구성
    switch(state.scanType) {
      case 'quick':
        scanData = {
          target: state.target,
          mode: 'quick',
          arguments: '-sT -T4 -F --open -p 21,22,23,25,53,80,110,139,443,445,3306,3389,8080 -sC -sV'
        };
        break;
        
      case 'full':
        scanData = {
          target: state.target,
          mode: 'full',
        };
        break;
        
      case 'custom':
      default:
        scanData = {
          target: state.target,
          mode: 'custom',
          ports: state.ports || '22,80,443', // 기본값 설정
          arguments: state.customArguments || buildScanArguments() // 인자 없으면 생성
        };
    }
    
    // 스캔 시작
    await startScan(scanData);
  }, [state, buildScanArguments, startScan, updateState]);

  // 옵션 변경 핸들러
  const handleOptionChange = useCallback((option: keyof typeof state.options) => {
    updateState({ 
      options: {
        ...state.options,
        [option]: !state.options[option],
      }
    });
  }, [state.options, updateState]);

  return {
    // 상태
    target: state.target,
    scanType: state.scanType,
    ports: state.ports,
    customArguments: state.customArguments,
    options: state.options,
    isLoading: state.isLoading,
    error: state.error,
    scanId: state.scanId,
    scanStatus: state.scanStatus,
    serverAvailable: state.serverAvailable,
    
    // 액션
    setTarget: (value: string) => updateState({ target: value }),
    setScanType: (value: ScanMode) => updateState({ scanType: value }),
    setPorts: (value: string) => updateState({ ports: value }),
    setCustomArguments: (value: string) => updateState({ customArguments: value }),
    handleOptionChange,
    
    // 핵심 기능
    handleSubmit,
    startScan,
    resetScan,
    checkServerStatus,
    addHostToTopology
  };
} 