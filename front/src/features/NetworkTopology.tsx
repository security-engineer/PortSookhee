import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
// react-cytoscapejs 모듈을 직접 불러오지 않고 cytoscape만 사용
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import { RootState } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { HostInfo, Vulnerability, ScanResult, PortInfo, TopologyNode, Report, ReportMeta } from '../types';
import { loadUserTopology, addNodeToTopology, setSelectedNode, addScanToTopology } from '../store/slices/topologySlice';
import { useAppDispatch } from '../store/hooks';
import { PlusCircle, Trash2, RefreshCw } from 'lucide-react';

// CytoscapeComponent를 직접 구현
interface CytoscapeComponentProps {
  elements: any[];
  style: React.CSSProperties;
  cy: (cy: any) => void;
}

// 임시 CytoscapeComponent 구현
const CytoscapeComponent: React.FC<CytoscapeComponentProps> = ({ elements, style, cy }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);
  
  // 레이아웃 적용 함수
  const applyLayout = useCallback((cytoscapeInstance: cytoscape.Core) => {
    if (!cytoscapeInstance || cytoscapeInstance.elements().length === 0) {
      console.warn("No elements to layout");
      return;
    }

    try {
      const layout = cytoscapeInstance.layout({
        name: 'grid', // 초기 레이아웃으로 grid 사용 (더 안정적)
        padding: 50,
        fit: true,
        animate: false, // 애니메이션 비활성화로 더 안정적
        stop: function() {
          // grid 레이아웃 완료 후 더 복잡한 레이아웃 적용 (선택적)
          setTimeout(() => {
            try {
              if (cytoscapeInstance && cytoscapeInstance.elements().length > 0) {
                cytoscapeInstance.layout({
                  name: 'cose',
                  animate: false,
                  nodeDimensionsIncludeLabels: true,
                  fit: true,
                  padding: 50,
                  randomize: true,
                  componentSpacing: 40,
                  nodeOverlap: 20,
                }).run();
                
                // 초기 줌 레벨 설정
                setTimeout(() => {
                  if (cytoscapeInstance) {
                    // 뷰포트 중앙에서 초기 줌 레벨을 0.8로 설정 (1보다 작으면 축소)
                    cytoscapeInstance.zoom({
                      level: 0.8,
                      renderedPosition: { 
                        x: cytoscapeInstance.width() / 2, 
                        y: cytoscapeInstance.height() / 2 
                      }
                    });
                  }
                }, 100);
              }
            } catch (error) {
              console.error("Error applying secondary layout:", error);
            }
          }, 100);
        }
      });
      
      layout.run();
    } catch (error) {
      console.error("Error applying layout:", error);
    }
  }, []);
  
  // Cytoscape 스타일 적용 함수
  const applyCytoscapeStyles = useCallback((cytoscapeInstance: cytoscape.Core) => {
    if (!cytoscapeInstance) return;
    
    try {
      cytoscapeInstance.style()
        .resetToDefault()
        .selector('node[?custom_data][custom_data.role = "central"]')
        .style({
          'background-color': '#3b82f6',
          'label': 'data(label)',
          'width': 60,
          'height': 60,
          'font-size': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'shape': 'hexagon'
        })
        .selector('node[type="host"]')
        .style({
          'background-color': (ele: NodeSingular) => {
            // 중앙 노드인 경우 이미 스타일이 적용됨
            if (ele.data('custom_data')?.role === 'central') return '#3b82f6';
            
            const vulnCount = ele.data('custom_data')?.highRiskCount || 0;
            if (vulnCount > 3) return '#ef4444'; // 높은 위험
            if (vulnCount > 0) return '#f97316'; // 중간 위험
            return '#22c55e'; // 낮은 위험
          },
          'label': (ele: NodeSingular) => {
            const label = ele.data('label');
            const ports = ele.data('custom_data')?.ports || ele.data('custom_data')?.open_ports || 0;
            const vulns = ele.data('custom_data')?.vulnCount || ele.data('vulnerabilities_count') || 0;
            
            // 중앙 노드인 경우 단순한 라벨만 표시
            if (ele.data('custom_data')?.role === 'central') return label;
            
            // 다른 노드들에는 상세 정보 포함
            return `${label}\n포트: ${ports} | 취약점: ${vulns}`;
          },
          'width': 50,
          'height': 50,
          'font-size': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'text-wrap': 'wrap',
          'text-max-width': '120px'
        })
        .selector('node[type="custom"]')
        .style({
          'background-color': '#8b5cf6', // 보라색
          'label': 'data(label)',
          'width': 50,
          'height': 50,
          'font-size': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'shape': 'diamond'
        })
        .selector('edge')
        .style({
          'width': 2,
          'line-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#94a3b8',
          'curve-style': 'bezier'
        })
        .selector(':selected')
        .style({
          'border-width': 3,
          'border-color': '#2563eb'
        })
        .update();
    } catch (error) {
      console.error("Error applying styles:", error);
    }
  }, []);
  
  // 요소 변경 시 Cytoscape 인스턴스 업데이트
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 요소가 비어있거나 노드가 없는 경우 일찍 반환
    if (!elements || elements.length === 0) {
      console.warn("No elements provided to CytoscapeComponent");
      return;
    }
    
    try {
      // 노드와 엣지를 분리하여 노드를 먼저 처리
      const nodes = elements.filter(ele => 
        ele && ele.data && !ele.data.source && !ele.data.target
      );
      
      // 노드가 없으면 처리 중단
      if (!nodes.length) {
        console.warn("No nodes provided to CytoscapeComponent");
        return;
      }
      
      const edges = elements.filter(ele => 
        ele && ele.data && ele.data.source && ele.data.target
      );
      
      // 노드 ID 목록
      const nodeIds = new Set(nodes.map(node => node.data.id));
      
      // 유효한 엣지만 필터링 (source와 target 노드가 모두 존재하는 경우만)
      const validEdges = edges.filter(edge => 
        nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
      );
      
      // 기존 인스턴스 정리
      if (cyInstanceRef.current) {
        cyInstanceRef.current.destroy();
        cyInstanceRef.current = null;
      }
      
      // 노드를 먼저 추가한 다음 유효한 엣지를 추가하여 Cytoscape 인스턴스 생성
      const instance = cytoscape({
        container: containerRef.current,
        elements: [...nodes, ...validEdges],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': '#666',
              'label': 'data(label)'
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2,
              'line-color': '#ccc',
              'target-arrow-shape': 'triangle',
              'target-arrow-color': '#ccc',
              'curve-style': 'bezier'
            }
          }
        ],
        layout: {
          name: 'grid', // 기본 레이아웃은 안정적인 grid 사용
          fit: true
        },
        // 렌더링 성능 옵션
        minZoom: 0.3,  // 최소 줌 레벨 낮춤
        maxZoom: 3,    // 최대 줌 레벨 제한
        wheelSensitivity: 0.15, // 휠 감도 낮춤 (천천히 줌)
        textureOnViewport: true, // 성능 향상을 위한 뷰포트 텍스처 사용
        hideEdgesOnViewport: true, // 뷰포트 이동 시 엣지 숨김
        hideLabelsOnViewport: true, // 뷰포트 이동 시 라벨 숨김
        // 동기화 문제 방지 옵션
        autoungrabify: false, // 노드 자동 고정 비활성화
        userPanningEnabled: true, // 사용자 패닝 활성화
        userZoomingEnabled: true, // 사용자 줌 활성화
      });
      
      // 인스턴스 참조 저장
      cyInstanceRef.current = instance;
      
      // 스타일 적용
      applyCytoscapeStyles(instance);
      
      // 안정적인 레이아웃 적용 (약간의 지연 후)
      setTimeout(() => {
        applyLayout(instance);
      }, 50);
      
      // 콜백 호출
      if (cy && instance) {
        cy(instance);
      }
    } catch (error) {
      console.error("Error initializing Cytoscape:", error);
    }
    
    // 컴포넌트 언마운트 시 정리
    return () => {
      if (cyInstanceRef.current) {
        try {
          cyInstanceRef.current.destroy();
          cyInstanceRef.current = null;
        } catch (error) {
          console.warn("Error destroying Cytoscape instance:", error);
        }
      }
    };
  }, [elements, cy, applyCytoscapeStyles, applyLayout]);
  
  return <div ref={containerRef} style={style} className="cytoscape-container" />;
};

interface NetworkTopologyProps {
  showAddReportButton?: boolean;
  simpleMode?: boolean;
}

const NetworkTopology: React.FC<NetworkTopologyProps> = ({ 
  showAddReportButton = false,
  simpleMode = false
}) => {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const dispatch = useAppDispatch();
  
  // Redux에서 현재 스캔, 취약점, 보고서, 토폴로지 정보 가져오기
  const { currentScan } = useSelector((state: RootState) => state.scan);
  const { currentVulnerability } = useSelector((state: RootState) => state.vulnerability);
  const { currentReport, reports } = useSelector((state: RootState) => state.report);
  const { userTopology, selectedNode, loading, error } = useSelector((state: RootState) => state.topology);
  
  // 통합 토폴로지로 변경 (스캔과 사용자 토폴로지를 분리하지 않음)
  const [elements, setElements] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [showModal, setShowModal] = useState(false);
  const [availableReports, setAvailableReports] = useState<ReportMeta[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
  // 컴포넌트 마운트 시 사용자 토폴로지 데이터 로드
  useEffect(() => {
    // simpleMode가 활성화되어 있으면 제한된 데이터만 로드
    if (simpleMode) {
      // 메인 호스트 노드만 포함하는 간소화된 토폴로지 생성
      const simplifiedTopology = {
        nodes: [{
          data: {
            id: 'main-host',
            label: '호스트',
            type: 'host',
            state: 'up',
            custom_data: {
              role: 'central',
              os: 'localhost',
              ports: 0,
              vulnCount: 0,
              highRiskCount: 0
            }
          }
        }],
        edges: []
      };
      
      setElements(simplifiedTopology);
      return;
    }
    
    // 일반 모드: 고정 사용자 ID 사용 (실제로는 로그인한 사용자 ID로 대체해야 함)
    const userId = 'current_user';
    dispatch(loadUserTopology(userId));
    
    // 사용 가능한 리포트 목록 설정
    if (reports && reports.length > 0) {
      setAvailableReports(reports);
    }
  }, [dispatch, reports, simpleMode]);
  
  // 현재 스캔 결과가 변경되면 사용자 토폴로지에 자동으로 추가 (simpleMode가 아닐 때만)
  useEffect(() => {
    if (!simpleMode && currentScan && userTopology) {
      const userId = 'current_user';
      dispatch(addScanToTopology({ userId, scanResult: currentScan }));
    }
  }, [currentScan, userTopology, dispatch, simpleMode]);

  // 통합된 토폴로지 요소 생성
  const generateTopologyElements = useCallback(() => {
    if (!userTopology) return { nodes: [], edges: [] };
    
    // 토폴로지가 비어있거나 노드가 없는 경우 기본 구조만 반환
    if (!userTopology.nodes || userTopology.nodes.length === 0) {
      return { 
        nodes: [{
          data: {
            id: 'main-host',
            label: '호스트',
            type: 'host',
            state: 'up',
            custom_data: {
              role: 'central',
              os: 'localhost',
              ports: 0,
              vulnCount: 0,
              highRiskCount: 0
            }
          }
        }], 
        edges: [] 
      };
    }
    
    // 모든 노드에 custom_data 및 role 속성 확인
    const nodes = userTopology.nodes.map(node => {
      // custom_data가 없으면 추가
      if (!node.custom_data) {
        node.custom_data = { 
          role: node.id === 'main-host' ? 'central' : 'node' 
        };
      } 
      // role이 없으면 추가
      else if (!node.custom_data.role) {
        node.custom_data.role = node.id === 'main-host' ? 'central' : 'node';
      }
      
      return {
        data: {
          ...node,
          label: node.label || node.id,
        }
      };
    });
    
    // 메인 호스트 노드가 존재하지 않으면 추가
    if (!nodes.some(node => node.data.id === 'main-host')) {
      nodes.unshift({
        data: {
          id: 'main-host',
          label: '호스트',
          type: 'host',
          state: 'up',
          custom_data: {
            role: 'central',
            os: 'localhost',
            ports: 0,
            vulnCount: 0,
            highRiskCount: 0
          }
        }
      });
    }
    
    // 엣지가 없거나 비어있는 경우 빈 배열 반환
    if (!userTopology.edges || userTopology.edges.length === 0) {
      return { nodes, edges: [] };
    }
    
    // 노드 ID 목록 (유효한 엣지 생성 확인용)
    const nodeIds = new Set(nodes.map(node => node.data.id));
    
    // 유효한 엣지만 포함
    const edges = userTopology.edges
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(edge => ({
        data: {
          ...edge,
        }
      }));
    
    return { nodes, edges };
  }, [userTopology]);
  
  // 호스트별 CVE 취약점 수 계산 - 메모리 사용량 최적화
  const getVulnCountForHost = useCallback((hostId: string) => {
    if (!currentVulnerability || !currentVulnerability.hosts) return 0;
    
    const host = currentVulnerability.hosts.find((h: HostInfo) => h.host === hostId);
    if (!host || !host.ports) return 0;
    
    return host.ports.reduce((count: number, port: any) => 
      count + (port.vulnerabilities?.length || 0), 0);
  }, [currentVulnerability]);
  
  // 높은 위험도(CVSS >= 7.0)의 취약점 수 계산 - 메모리 사용량 최적화
  const getHighRiskVulnCountForHost = useCallback((hostId: string) => {
    if (!currentVulnerability || !currentVulnerability.hosts) return 0;
    
    const host = currentVulnerability.hosts.find((h: HostInfo) => h.host === hostId);
    if (!host || !host.ports) return 0;
    
    return host.ports.reduce((count: number, port: any) => {
      if (!port.vulnerabilities) return count;
      return count + port.vulnerabilities.filter((vuln: Vulnerability) => vuln.cvss_score >= 7.0).length;
    }, 0);
  }, [currentVulnerability]);
  
  // 노드 클릭 핸들러 - 통합 버전
  const handleNodeClick = useCallback((nodeId: string) => {
    if (!userTopology || !userTopology.nodes) return;
    
    const node = userTopology.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    dispatch(setSelectedNode(node));
  }, [userTopology, dispatch]);
  
  // 토폴로지 데이터 초기화 함수
  const resetTopology = () => {
    if (window.confirm('토폴로지 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      // 모든 사용자 토폴로지 데이터를 삭제하기 위해 키 패턴으로 검색
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('topology_')) {
          keysToRemove.push(key);
        }
      }
      
      // 찾은 키 모두 제거
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 기본 사용자 ID로 새 토폴로지 로드
      dispatch(loadUserTopology('user1'));
    }
  };
  
  // 리포트 선택 모달 열기
  const openReportModal = () => {
    setShowModal(true);
  };

  // 리포트 선택 모달 닫기
  const closeReportModal = () => {
    setShowModal(false);
  };
  
  // 리포트를 토폴로지에 노드로 추가
  const handleAddReportNode = useCallback(() => {
    if (!currentReport || !currentReport.report_id) return;
    
    // 고정 사용자 ID (실제로는 로그인한 사용자 ID로 대체)
    const userId = 'user1';
    
    try {
      // 중요 취약점 갯수 계산 (CVSS >= 7.0)
      let highRiskCount = 0;
      let vulnCount = 0;
      let openPortsCount = 0;
      let services: string[] = [];
      
      if (currentReport.details.hosts && Array.isArray(currentReport.details.hosts)) {
        currentReport.details.hosts.forEach(host => {
          if (host.ports) {
            openPortsCount += host.ports.filter(port => port.state === 'open').length;
            
            // 서비스 정보 수집
            host.ports.forEach(port => {
              if (port.service && port.state === 'open' && !services.includes(port.service)) {
                services.push(port.service);
              }
              
              // 취약점 카운트
              if (port.vulnerabilities && Array.isArray(port.vulnerabilities)) {
                vulnCount += port.vulnerabilities.length;
                highRiskCount += port.vulnerabilities.filter(vuln => vuln.cvss_score >= 7.0).length;
              }
            });
          }
        });
      }
      
      // 위험도에 따른 레이블 설정
      let riskLevel = '낮음';
      if (highRiskCount > 3) riskLevel = '심각';
      else if (highRiskCount > 0) riskLevel = '높음';
      else if (vulnCount > 3) riskLevel = '중간';
      
      // 현재 리포트를 노드로 변환 - 최소한의 필요한 데이터만 포함
      const newNode: TopologyNode = {
        id: `report-${currentReport.report_id}`,
        label: `${currentReport.details.target}`,
        type: 'host', // 모든 노드를 host 타입으로 통일
        report_id: currentReport.report_id,
        scan_id: currentReport.details.scan_id,
        timestamp: currentReport.timestamp,
        target: currentReport.details.target,
        risk_level: riskLevel,
        vulnerabilities_count: vulnCount,
        high_risk_count: highRiskCount,
        ip_address: currentReport.details.target,
        description: `${vulnCount}개의 취약점 발견`,
        custom_data: {
          role: 'node',
          host: {
            host: currentReport.details.target,
            ports: openPortsCount
          },
          services: services,
          vulnerabilities_summary: {
            total: vulnCount,
            high_risk: highRiskCount
          },
          open_ports: openPortsCount
        }
      };
      
      // 메인 호스트 노드와 새 노드를 연결하는 엣지
      const newEdge = {
        id: `e-main-host-${newNode.id}`,
        source: 'main-host',
        target: newNode.id,
        label: 'scanned'
      };
      
      // 토폴로지에 노드와 엣지 추가
      dispatch(addNodeToTopology({
        userId,
        node: newNode,
        edges: [newEdge]
      }));
      
    } catch (error) {
      console.error('리포트 노드 추가 오류:', error);
    }
  }, [currentReport, dispatch, simpleMode]);

  // 선택된 리포트 노드 추가
  const handleAddReportFromModal = useCallback((reportId: string) => {
    // 리포트 가져오기 로직 필요
    closeReportModal();
  }, []);
  
  // 요소 설정 - simpleMode에서는 메모리 최적화를 위해 레이아웃 계산 최소화
  useEffect(() => {
    if (simpleMode) {
      return; // simpleMode에서는 이미 초기화된 elements를 사용
    }
    
    const newElements = generateTopologyElements();
    setElements(newElements);
    
    // 이전 cytoscape 인스턴스 정리
    if (cyRef.current) {
      try {
        // 기존 이벤트 리스너 제거
        cyRef.current.removeAllListeners();
      } catch (error) {
        console.warn("Error cleaning up cytoscape instance:", error);
      }
    }
    
    return () => {
      // 컴포넌트 언마운트 시 정리
      if (cyRef.current) {
        try {
          cyRef.current.removeAllListeners();
        } catch (error) {
          console.warn("Error cleaning up cytoscape instance on unmount:", error);
        }
      }
    };
  }, [currentScan, currentVulnerability, userTopology, generateTopologyElements, simpleMode]);
  
  // 요소 가공 - 노드를 엣지보다 먼저 배치하여 엣지 생성 오류 방지
  const processedElements = React.useMemo(() => {
    // 요소가 없으면 빈 배열 반환
    if (!elements.nodes || !elements.nodes.length) return [];
    
    try {
      // 노드 ID 세트 생성
      const nodeIds = new Set(elements.nodes.map(node => node.data.id));
      
      // 유효한 엣지만 필터링 (source와 target 노드가 모두 존재하는 경우만)
      const validEdges = elements.edges && elements.edges.length > 0 ? 
        elements.edges.filter(edge => 
          edge.data && edge.data.source && edge.data.target &&
          nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)
        ) : [];
      
      // 노드를 먼저 배치, 그 다음 유효한 엣지 배치
      return [...elements.nodes, ...validEdges];
    } catch (error) {
      console.error("Error processing elements:", error);
      // 오류 발생 시 노드만 반환
      return elements.nodes || [];
    }
  }, [elements]);
  
  // CVSS 점수에 따른 색상 스타일
  const getCvssSeverity = useCallback((score: number) => {
    if (score >= 9) return 'destructive';
    if (score >= 7) return 'destructive';
    if (score >= 4) return 'warning';
    return 'success';
  }, []);
  
  // 위험도에 따른 배지 스타일 반환
  const getRiskLevelVariant = (riskLevel: string) => {
    switch(riskLevel?.toLowerCase()) {
      case '심각': return 'destructive';
      case '높음': return 'destructive';
      case '중간': return 'warning';
      case '낮음': return 'success';
      default: return 'secondary';
    }
  };
  
  // 줌 제어 함수
  const handleZoomIn = useCallback(() => {
    if (cyRef.current) {
      const currentZoom = cyRef.current.zoom();
      const newZoom = currentZoom * 1.2; // 20% 확대
      cyRef.current.animate({
        zoom: newZoom,
        duration: 200
      });
      setZoomLevel(newZoom);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (cyRef.current) {
      const currentZoom = cyRef.current.zoom();
      const newZoom = currentZoom * 0.8; // 20% 축소
      cyRef.current.animate({
        zoom: newZoom,
        duration: 200
      });
      setZoomLevel(newZoom);
    }
  }, []);

  const handleResetZoom = useCallback(() => {
    if (cyRef.current) {
      // 먼저 그래프를 화면에 맞게 조정하고, 그 다음 줌 레벨 변경
      cyRef.current.fit();
      setTimeout(() => {
        if (cyRef.current) {
          cyRef.current.zoom(0.8);
          setZoomLevel(0.8);
        }
      }, 100);
    }
  }, []);
  
  // 노드 요약 정보 생성
  const generateNodeSummary = useCallback((node: TopologyNode) => {
    if (!node) return null;
    
    const openPorts = node.custom_data?.open_ports || node.custom_data?.host?.ports || 0;
    const vulnerabilityCount = node.vulnerabilities_count || node.custom_data?.vulnerabilities_summary?.total || 0;
    const highRiskCount = node.high_risk_count || node.custom_data?.vulnerabilities_summary?.high_risk || 0;
    
    return {
      openPorts,
      vulnerabilityCount,
      highRiskCount,
      hasServices: !!(node.custom_data?.services && node.custom_data.services.length > 0)
    };
  }, []);
  
  // 현재 리포트가 변경될 때 자동으로 토폴로지에 추가
  useEffect(() => {
    // simpleMode에서는 처리하지 않음
    if (simpleMode) return;
    
    // 현재 리포트가 있고, 이미 토폴로지가 로드된 상태에서만 처리
    if (currentReport && currentReport.report_id && userTopology) {
      // 이미 해당 리포트 노드가 있는지 확인
      const existingNode = userTopology.nodes.find(node => 
        node.report_id === currentReport.report_id
      );
      
      // 이미 존재하지 않는 경우에만 추가
      if (!existingNode) {
        console.log('새 리포트를 토폴로지에 자동으로 추가합니다:', currentReport.report_id);
        handleAddReportNode();
      }
    }
  }, [currentReport, userTopology, simpleMode, handleAddReportNode]);
  
  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>네트워크 토폴로지</CardTitle>
          <div className="flex gap-2">
            {!simpleMode && showAddReportButton && (
              <Button variant="outline" size="sm" onClick={handleAddReportNode}>
                <PlusCircle className="h-4 w-4 mr-1" /> 리포트 추가
              </Button>
            )}
            {!simpleMode && (
              <Button variant="destructive" size="sm" title="토폴로지 초기화" onClick={resetTopology}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>네트워크 스캔 결과와 발견된 취약점을 시각화합니다</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="relative">
            <div className={`w-full ${simpleMode ? 'h-[400px]' : 'h-[650px]'} border rounded`}>
              {elements.nodes && elements.nodes.length > 0 ? (
                <CytoscapeComponent
                  elements={processedElements}
                  style={{ width: '100%', height: '100%' }}
                  cy={(cytoscapeInstance: any) => { 
                    if (!cytoscapeInstance) return;
                    
                    cyRef.current = cytoscapeInstance;
                    
                    // 기존 이벤트 리스너 제거 후 다시 추가
                    cytoscapeInstance.off('tap', 'node');
                    cytoscapeInstance.on('tap', 'node', (event: any) => {
                      const nodeId = event.target.id();
                      handleNodeClick(nodeId);
                    });
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  토폴로지 데이터가 없습니다. 스캔을 실행하거나 리포트를 추가해주세요.
                </div>
              )}
            </div>
            {/* 줌 컨트롤 버튼 추가 */}
            {!simpleMode && (
              <div className="absolute bottom-4 right-4 bg-secondary/70 rounded shadow-md p-2 flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={handleZoomIn} title="확대">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleResetZoom} title="초기화">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path d="M9 12h6" />
                  </svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleZoomOut} title="축소">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </Button>
              </div>
            )}
          </div>
          
          <div className={`w-full ${simpleMode ? 'h-[400px]' : 'h-[650px]'} overflow-auto`}>
            {selectedNode && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {selectedNode.ip_address || selectedNode.label}
                  {selectedNode.risk_level && (
                    <Badge variant={getRiskLevelVariant(selectedNode.risk_level)}>
                      위험도: {selectedNode.risk_level}
                    </Badge>
                  )}
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-4 bg-secondary/50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-secondary-foreground">포트</h4>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                      </svg>
                    </div>
                    <div className="text-2xl font-bold">{selectedNode.custom_data?.open_ports || selectedNode.custom_data?.host?.ports || 0}</div>
                    <div className="text-sm text-muted-foreground">열린 포트</div>
                  </div>
                  <div className="p-4 bg-secondary/50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-secondary-foreground">취약점</h4>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                      </svg>
                    </div>
                    <div className="text-2xl font-bold">{selectedNode.vulnerabilities_count || selectedNode.custom_data?.vulnerabilities_summary?.total || 0}</div>
                    <div className="text-sm text-muted-foreground">취약점</div>
                  </div>
                </div>
                
                {!simpleMode && (
                  <>
                    <div className="p-4 bg-secondary/50 rounded mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-secondary-foreground">노드 정보</h4>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">호스트:</span> {selectedNode.ip_address || selectedNode.label}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">상태:</span> {selectedNode.state || "알 수 없음"}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">OS:</span> {selectedNode.custom_data?.os || "알 수 없음"}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">유형:</span> {selectedNode.custom_data?.role === "central" ? "중앙 호스트" : "호스트"}
                        </div>
                      </div>
                    </div>
                
                    {selectedNode.custom_data?.services && selectedNode.custom_data.services.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                          </svg>
                          실행 중인 서비스
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedNode.custom_data.services.map((service: string, i: number) => (
                            <Badge key={i} variant="outline">{service}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                
                    {selectedNode.high_risk_count && selectedNode.high_risk_count > 0 && (
                      <div className="p-3 bg-destructive/10 rounded border border-destructive/20 mb-4">
                        <h4 className="text-sm font-medium flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                            <line x1="12" y1="9" x2="12" y2="13"></line>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                          </svg>
                          중요 취약점
                        </h4>
                        <p className="text-destructive">
                          {selectedNode.high_risk_count}개의 심각한 취약점이 발견되었습니다 (CVSS ≥ 7.0)
                        </p>
                      </div>
                    )}
                  </>
                )}
                
                {selectedNode.timestamp && (
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    스캔 날짜: {new Date(selectedNode.timestamp).toLocaleString()}
                  </div>
                )}
                
                {selectedNode.report_id && (
                  <a 
                    href={`/reports/${selectedNode.report_id}`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input hover:bg-accent hover:text-accent-foreground w-full mt-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    상세 리포트 보기
                  </a>
                )}
              </div>
            )}
            
            {!selectedNode && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                노드를 클릭하면 정보가 표시됩니다
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkTopology; 