import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import apiService from '../services/api';
import { RootState } from '../store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../components/ui/dialog';
import { HostInfo, Vulnerability, TopologyNode, Report, ReportMeta, TopologyEdge } from '../types';
import { loadUserTopology, addNodeToTopology, setSelectedNode, addScanToTopology, removeNodesFromTopology } from '../store/slices/topologySlice';
import { setCurrentReport } from '../store/slices/reportSlice';
import { useAppDispatch } from '../store/hooks';
import { PlusCircle, RefreshCw, Trash2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// CytoscapeComponent를 직접 구현
interface CytoscapeComponentProps {
  elements: any[];
  style: React.CSSProperties;
  cy: (cy: any) => void;
}

const CytoscapeComponent: React.FC<CytoscapeComponentProps> = ({ elements, style, cy: cyCallback }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const applyLayout = useCallback((cytoscapeInstance: cytoscape.Core) => {
    if (!cytoscapeInstance || cytoscapeInstance.destroyed() || cytoscapeInstance.elements().length === 0) {
      return;
    }
    try {
      cytoscapeInstance.layout({ 
        name: 'cose', 
        animate: true,
        animationDuration: 1200,
        animationEasing: 'ease-in-out',
        fit: true, 
        padding: 80,
        nodeRepulsion: () => 450000,
        idealEdgeLength: () => 150,
        gravity: 70,
        randomize: false,
        refresh: 20,
        componentSpacing: 150,
        initialTemp: 35,
        coolingFactor: 0.95
      }).run();
    } catch (error) {
      console.error("Error applying layout:", error);
    }
  }, []);

  const applyCytoscapeStyles = useCallback((cytoscapeInstance: cytoscape.Core) => {
    if (!cytoscapeInstance) return;
    try {
      const laptopIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMCAxNlY3YTIgMiAwIDAgMC0yLTJINmEyIDIgMCAwIDAtMiAydjltMTYgMEg0bTE2IDAgbDEuMjggMi41NUExIDEgMCAwIDEgMjAuMjggMjBIMy43MmExIDEgMCAwIDEtLjk4LTEuNDVMNCAxNnoiPjwvcGF0aD48L3N2Zz4=';
      const globeIcon = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiPjwvY2lyY2xlPjxsaW5lIHgxPSIyIiB5MT0iMTIiIHgyPSIyMiIgeTI9IjEyIj48L2xpbmU+PHBhdGggZD0iTTEyIDJhMTUuMyAxNS4zIDAgMCAxIDQgMTAgMTUuMyAxNS4zIDAgMCAxLTQgMTAgMTUuMyAxNS4zIDAgMCAxLTQgLTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiI+PC9wYXRoPjwvc3ZnPg==';

      cytoscapeInstance.style()
        .resetToDefault()
        .selector('node')
          .style({
            'shape': 'ellipse',
            'width': 80, 'height': 80,
            'background-image': laptopIcon,
            'background-fit': 'cover',
            'background-position-x': '50%',
            'background-position-y': '45%',
            'background-width': '50%',
            'border-width': 1,
            'border-color': '#93c5fd',
            'label': 'data(label)',
            'font-size': 13, 'color': '#334155', 'font-weight': 'bold',
            'text-valign': 'bottom', 'text-halign': 'center', 'text-margin-y': 8,
            'text-wrap': 'wrap', 'text-max-width': '120px',
            'transition-property': 'background-color, shadow-blur, shadow-color, border-color',
            'transition-duration': 300,
            'shadow-blur': 10, 'shadow-opacity': 0.35, 'shadow-color': '#94a3b8',
            'text-outline-color': '#ffffff', 'text-outline-width': 1,
            'overlay-padding': 6,
            'z-index': 10
          } as any)
        .selector('.central-node')
          .style({ 
            'shape': 'ellipse',
            'background-color': '#3b82f6',
            'background-image': globeIcon,
            'border-color': '#0c4a6e',
            'border-width': 1,
            'width': 90, 'height': 90,
            'font-size': 15,
            'text-outline-color': '#ffffff', 'text-outline-width': 2,
            'color': '#1e3a8a',
            'shadow-blur': 15, 'shadow-opacity': 0.5, 'shadow-color': '#60a5fa',
            'overlay-padding': 8
          } as any)
        .selector('.high-risk')
          .style({ 
            'background-color': '#fee2e2',
            'border-color': '#dc2626',
            'border-width': 2,
            'shadow-blur': 12, 'shadow-opacity': 0.6, 'shadow-color': '#ef4444'
          } as any)
        .selector('.medium-risk')
          .style({ 
            'background-color': '#fff7ed',
            'border-color': '#f59e0b',
            'border-width': 2,
            'shadow-blur': 12, 'shadow-opacity': 0.5, 'shadow-color': '#f59e0b'
          } as any)
        .selector('.low-risk')
          .style({ 
            'background-color': '#f0fdf4',
            'border-color': '#16a34a',
            'border-width': 2,
            'shadow-blur': 12, 'shadow-opacity': 0.5, 'shadow-color': '#22c55e'
          } as any)
        .selector('edge')
          .style({ 
            'width': 2, 
            'line-color': '#cbd5e1', 
            'target-arrow-color': '#cbd5e1',
            'target-arrow-shape': 'triangle', 
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [40],
            'control-point-weights': [0.5],
            'edge-distances': 'node-position',
            'transition-property': 'line-color, target-arrow-color, width', 
            'transition-duration': 300,
            'z-index': 1
          } as any)
        .selector(':selected')
          .style({ 
            'border-width': 3,
            'border-color': '#3b82f6',
            'shadow-blur': 25,
            'shadow-opacity': 0.8,
            'shadow-color': (ele: NodeSingular) => {
                if (ele.hasClass('high-risk')) return '#ef4444';
                if (ele.hasClass('medium-risk')) return '#f59e0b';
                if (ele.hasClass('low-risk')) return '#22c55e';
                if (ele.hasClass('central-node')) return '#60a5fa';
                return '#3b82f6';
            },
            'z-index': 20
          } as any)
        .selector('node:hover')
          .style({
             'shadow-blur': 20,
             'shadow-opacity': 0.7,
             'shadow-color': '#60a5fa',
             'background-color': (ele: NodeSingular) => {
                if (ele.hasClass('high-risk')) return '#fecaca';
                if (ele.hasClass('medium-risk')) return '#ffedd5';
                if (ele.hasClass('low-risk')) return '#dcfce7';
                if (ele.hasClass('central-node')) return '#60a5fa';
                return '#bfdbfe';
             },
             'overlay-opacity': 0.1,
             'overlay-color': '#60a5fa',
             'transition-property': 'shadow-blur, shadow-opacity, background-color',
             'transition-duration': 200,
             'z-index': 30
          } as any)
        .selector('edge:hover')
          .style({ 
            'line-color': '#60a5fa', 
            'target-arrow-color': '#60a5fa', 
            'width': 3,
            'z-index': 15
          } as any)
        .update();
    } catch (error) {
      console.error("Error applying styles:", error);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    let cyInstance: cytoscape.Core;

    if (!cyRef.current) {
      cyInstance = cytoscape({
        container: containerRef.current,
        minZoom: 0.5,
        maxZoom: 3,
        wheelSensitivity: 0.3,
      });
      cyRef.current = cyInstance;
    } else {
      cyInstance = cyRef.current;
    }
    
    cyInstance.json({ elements });
    applyCytoscapeStyles(cyInstance);
    applyLayout(cyInstance);
    cyCallback(cyInstance); // 항상 최신 인스턴스로 콜백 호출

    return () => {
      // 컴포넌트가 언마운트될 때만 destroy
      if (cyInstance && !cyInstance.destroyed() && cyInstance.container()?.isConnected === false) {
          cyInstance.destroy();
          cyRef.current = null;
      }
    };
  }, [elements, cyCallback, applyLayout, applyCytoscapeStyles]);

  return <div ref={containerRef} style={style} />;
};

// 리포트로부터 노드와 엣지를 생성하는 헬퍼 함수
const createNodeAndEdgeFromReport = (report: Report): { node: TopologyNode; edge: TopologyEdge } | null => {
    if (!report || !report.report_id || !report.details) {
        console.error('Cannot create node from invalid report:', report);
        return null;
    }
    
    let highRiskCount = 0;
    let vulnCount = 0;
    let openPortsCount = 0;
    let services: string[] = [];

    if (report.details.hosts && Array.isArray(report.details.hosts)) {
        report.details.hosts.forEach(host => {
            if (host.ports) {
                openPortsCount += host.ports.filter(port => port.state === 'open').length;
                host.ports.forEach(port => {
                    if (port.service && port.state === 'open' && !services.includes(port.service)) {
                        services.push(port.service);
                    }
                    if (port.vulnerabilities && Array.isArray(port.vulnerabilities)) {
                        vulnCount += port.vulnerabilities.length;
                        highRiskCount += port.vulnerabilities.filter(vuln => (vuln.cvss_score ?? 0) >= 7.0).length;
                    }
                });
            }
        });
    }

    let riskLevel = '낮음';
    if (highRiskCount > 3) riskLevel = '심각';
    else if (highRiskCount > 0) riskLevel = '높음';
    else if (vulnCount > 3) riskLevel = '중간';

    const newNode: TopologyNode = {
        id: `report-${report.report_id}`,
        label: `${report.details.target || `report-${report.report_id.slice(-8)}`}`,
        type: 'host',
        report_id: report.report_id,
        scan_id: report.details.scan_id,
        timestamp: report.timestamp,
        target: report.details.target,
        risk_level: riskLevel,
        vulnerabilities_count: vulnCount,
        high_risk_count: highRiskCount,
        ip_address: report.details.target,
        description: `${vulnCount}개의 취약점 발견`,
        custom_data: {
            role: 'node',
            os: report.details.hosts?.[0]?.os?.name || 'Unknown',
            ports: openPortsCount,
            vulnCount: vulnCount,
            highRiskCount: highRiskCount,
            services: services,
            host: { host: report.details.target, ports: openPortsCount },
            vulnerabilities_summary: { total: vulnCount, high_risk: highRiskCount },
            open_ports: openPortsCount
        }
    };

    const newEdge: TopologyEdge = {
        id: `e-main-host-${newNode.id}`,
        source: 'main-host',
        target: newNode.id,
        label: 'scanned'
    };

    return { node: newNode, edge: newEdge };
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
  const location = useLocation();
  const navigate = useNavigate();
  
  const { currentScan } = useSelector((state: RootState) => state.scan);
  const { currentVulnerability } = useSelector((state: RootState) => state.vulnerability);
  const { currentReport, reports } = useSelector((state: RootState) => state.report);
  const { userTopology, selectedNode } = useSelector((state: RootState) => state.topology);
  const { activeProfileId } = useSelector((state: RootState) => state.profile);
  
  const [elements, setElements] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportsForModal, setReportsForModal] = useState<ReportMeta[]>([]);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const reportIdToAdd = params.get('add_report');

    if (reportIdToAdd && !simpleMode) {
      const fetchAndSetReport = async () => {
        try {
          const reportResponse = await apiService.getReportById(reportIdToAdd);
          dispatch(setCurrentReport(reportResponse.data));
        } catch (error) {
          console.error(`리포트 ID ${reportIdToAdd} 가져오기 실패:`, error);
        } finally {
          navigate('/', { replace: true });
        }
      };
      
      fetchAndSetReport();
    }
  }, [location.search, dispatch, navigate, simpleMode]);
  
  useEffect(() => {
    if (simpleMode) {
      const simplifiedTopology = {
        nodes: [{
          data: {
            id: 'main-host',
            label: 'Host',
            type: 'host',
            state: 'up',
            custom_data: { role: 'central', os: 'localhost', ports: 0, vulnCount: 0, highRiskCount: 0 }
          }
        }],
        edges: []
      };
      setElements(simplifiedTopology);
      return;
    }
    
    if (activeProfileId) {
      dispatch(loadUserTopology(activeProfileId));
    }
    
    if (reports && reports.length > 0) {
      setReportsForModal(reports);
    }
  }, [dispatch, reports, simpleMode, activeProfileId]);
  
  useEffect(() => {
    if (!simpleMode && currentScan && userTopology && activeProfileId) {
      dispatch(addScanToTopology({ profileId: activeProfileId, scanResult: currentScan }));
    }
  }, [currentScan, userTopology, dispatch, simpleMode, activeProfileId]);

  const generateTopologyElements = useCallback(() => {
    if (!userTopology) return { nodes: [], edges: [] };
    
    const baseNodes = (userTopology.nodes || []).map(node => {
      let riskClass = '';
      if (node.id !== 'main-host') {
          const highRiskCount = node.high_risk_count ?? 0;
          if (highRiskCount > 3) riskClass = 'high-risk';
          else if (highRiskCount > 0) riskClass = 'medium-risk';
          else riskClass = 'low-risk';
      } else {
          riskClass = 'central-node';
      }
      
      const nodeData = { ...node, label: node.label || node.id };
      if (node.id === 'main-host') {
          nodeData.label = 'Host';
      }

      return { data: nodeData, classes: riskClass };
    });
    
    if (!baseNodes.some(node => node.data.id === 'main-host')) {
      baseNodes.unshift({
        data: {
          id: 'main-host', label: '메인 네트워크', type: 'host', state: 'up',
          custom_data: { role: 'central', os: 'localhost', ports: 0, vulnCount: 0, highRiskCount: 0 }
        },
        classes: 'central-node'
      });
    }
    
    const nodeIds = new Set(baseNodes.map(node => node.data.id));
    const edges = (userTopology.edges || [])
      .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map(edge => ({ data: { ...edge } }));
    
    return { nodes: baseNodes, edges };
  }, [userTopology]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (!userTopology || !userTopology.nodes) return;
    const node = userTopology.nodes.find(n => n.id === nodeId);
    if (!node) return;
    dispatch(setSelectedNode(node));
  }, [userTopology, dispatch]);
  
  const resetTopology = () => {
    if (window.confirm('현재 프로필의 토폴로지 데이터를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
        if (!activeProfileId) return;
        localStorage.removeItem(`topology_${activeProfileId}`);
        dispatch(loadUserTopology(activeProfileId));
    }
  };
  
  const handleDeleteSelected = () => {
    if (!cyRef.current || !activeProfileId) return;
    const selectedNodes = cyRef.current.nodes(':selected');
    if (selectedNodes.length === 0) {
      alert('삭제할 노드를 선택해주세요.');
      return;
    }

    const nodeIdsToDelete = selectedNodes.map(node => node.id()).filter(id => id !== 'main-host');
    
    if (nodeIdsToDelete.length === 0) {
        alert('Host 노드는 삭제할 수 없습니다.');
        return;
    }

    if (window.confirm(`${nodeIdsToDelete.length}개의 노드를 삭제하시겠습니까?`)) {
      dispatch(removeNodesFromTopology({ profileId: activeProfileId, nodeIds: nodeIdsToDelete }));
    }
  };
  
  const handleAddReportNode = useCallback(() => {
    if (!currentReport || !activeProfileId) return;
    try {
      const result = createNodeAndEdgeFromReport(currentReport);
      if (result) {
        const { node, edge } = result;
        dispatch(addNodeToTopology({ profileId: activeProfileId, node, edges: [edge] }));
      }
    } catch (error) {
      console.error('리포트 노드 추가 오류:', error);
    }
  }, [currentReport, dispatch, activeProfileId]);
  
  

  const openReportModal = async () => {
    if (!activeProfileId) {
      console.warn("프로필이 선택되지 않아 리포트를 불러올 수 없습니다.");
      return;
    }
    setIsFetchingReports(true);
    try {
      const reportListResponse = await apiService.getReportList(activeProfileId);
      const reports = Array.isArray(reportListResponse.data) ? reportListResponse.data : reportListResponse.data.reports || [];
      setReportsForModal(reports);
      setIsModalOpen(true);
    } catch (error) {
      console.error("리포트 목록을 불러오는 데 실패했습니다:", error);
    } finally {
      setIsFetchingReports(false);
    }
  };

  const handleAddReportFromModal = useCallback(async (reportId: string) => {
    if (!reportId || !activeProfileId) return;
    try {
      const reportResponse = await apiService.getReportById(reportId);
      const reportToAdd: Report = reportResponse.data;

      // --- 중요: 프로필 소유권 검증 ---
      if (reportToAdd.profile_id && reportToAdd.profile_id !== activeProfileId) {
        alert('다른 프로필에 속한 리포트는 현재 토폴로지에 추가할 수 없습니다.');
        return;
      }

      if (reportToAdd && !reportToAdd.report_id) reportToAdd.report_id = reportId;
      const result = createNodeAndEdgeFromReport(reportToAdd);
      if (result) {
        const { node, edge } = result;
        dispatch(addNodeToTopology({ profileId: activeProfileId, node, edges: [edge] }));
        setIsModalOpen(false);
      } else {
         console.error('토폴로지에 추가할 유효하지 않은 리포트입니다.', { reportToAdd });
      }
    } catch (error) {
      console.error(`리포트 노드 추가 중 오류 발생 (ID: ${reportId}):`, error);
    }
  }, [dispatch, activeProfileId]);
  
  useEffect(() => {
    if (simpleMode) return;
    const newElements = generateTopologyElements();
    setElements(newElements);
  }, [currentScan, currentVulnerability, userTopology, generateTopologyElements, simpleMode]);
  
  const processedElements = useMemo(() => {
    if (!elements.nodes || !elements.nodes.length) return [];
    try {
      const nodeIds = new Set(elements.nodes.map(node => node.data.id));
      const validEdges = elements.edges?.filter(edge => 
          edge.data && nodeIds.has(edge.data.source) && nodeIds.has(edge.data.target)) || [];
      return [...elements.nodes, ...validEdges];
    } catch (error) {
      console.error("Error processing elements:", error);
      return elements.nodes || [];
    }
  }, [elements]);
  
  const getRiskLevelVariant = (riskLevel: string) => {
    switch(riskLevel?.toLowerCase()) {
      case '심각': return 'destructive';
      case '높음': return 'destructive';
      case '중간': return 'warning';
      case '낮음': return 'success';
      default: return 'secondary';
    }
  };
  
  const handleZoomIn = useCallback(() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2), []);
  const handleZoomOut = useCallback(() => cyRef.current?.zoom(cyRef.current.zoom() / 1.2), []);
  const handleResetZoom = useCallback(() => cyRef.current?.fit(), []);
  
  const generateNodeSummary = useCallback((node: TopologyNode) => {
    if (!node) return null;
    
    const ports = node.custom_data?.host?.ports;
    const openPorts = node.custom_data?.open_ports ?? 
      (Array.isArray(ports) ? ports.length : (typeof ports === 'number' ? ports : 0));
      
    const vulnerabilityCount = node.vulnerabilities_count ?? node.custom_data?.vulnerabilities_summary?.total ?? 0;
    const highRiskCount = node.high_risk_count ?? node.custom_data?.vulnerabilities_summary?.high_risk ?? 0;
    
    return {
      openPorts,
      vulnerabilityCount,
      highRiskCount,
      hasServices: !!(node.custom_data?.services && node.custom_data.services.length > 0)
    };
  }, []);
  
  useEffect(() => {
    if (simpleMode) return;
    if (currentReport && currentReport.report_id && userTopology) {
      const existingNode = userTopology.nodes.find(node => node.report_id === currentReport.report_id);
      if (!existingNode) handleAddReportNode();
    }
  }, [currentReport, userTopology, simpleMode, handleAddReportNode]);
  
  const setCyReference = useCallback((cytoscapeInstance: cytoscape.Core) => {
    if (!cytoscapeInstance) return;
    cyRef.current = cytoscapeInstance;

    // 기존 리스너를 제거하고 최신 핸들러로 새로 등록
    cytoscapeInstance.removeAllListeners();
    cytoscapeInstance.on('tap', 'node', (event: any) => handleNodeClick(event.target.id()));
  }, [handleNodeClick]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle>네트워크 토폴로지</CardTitle>
          <div className="flex gap-2">
            {!simpleMode && showAddReportButton && (
              <Button variant="outline" size="sm" onClick={openReportModal} disabled={isFetchingReports}>
                <PlusCircle className="h-4 w-4 mr-1" /> {isFetchingReports ? '로딩 중...' : '리포트 추가'}
              </Button>
            )}
            {!simpleMode && (
              <>
                <Button variant="outline" size="sm" title="선택한 노드 삭제" onClick={handleDeleteSelected}>
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button variant="destructive" size="sm" title="토폴로지 초기화" onClick={resetTopology}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </>
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
                <CytoscapeComponent elements={processedElements} style={{ width: '100%', height: '100%' }} cy={setCyReference} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  토폴로지 데이터가 없습니다. 스캔을 실행하거나 리포트를 추가해주세요.
                </div>
              )}
            </div>
            {!simpleMode && (
              <div className="absolute bottom-4 right-4 bg-secondary/70 rounded shadow-md p-2 flex flex-col gap-1">
                <Button variant="ghost" size="sm" onClick={handleZoomIn} title="확대">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleResetZoom} title="초기화">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path d="M9 12h6" /></svg>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleZoomOut} title="축소">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                </Button>
              </div>
            )}
          </div>
          
          <div className={`w-full ${simpleMode ? 'h-[400px]' : 'h-[650px]'} overflow-auto`}>
            {selectedNode && (() => {
              const summary = generateNodeSummary(selectedNode);
              if (!summary) return null;

              return (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    {selectedNode.ip_address || selectedNode.label}
                    {selectedNode.risk_level && ( <Badge variant={getRiskLevelVariant(selectedNode.risk_level)}>위험도: {selectedNode.risk_level}</Badge> )}
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-secondary/50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-secondary-foreground">포트</h4>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                      </div>
                      <div className="text-2xl font-bold">{summary.openPorts}</div>
                      <div className="text-sm text-muted-foreground">열린 포트</div>
                    </div>
                    <div className="p-4 bg-secondary/50 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-secondary-foreground">취약점</h4>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      </div>
                      <div className="text-2xl font-bold">{summary.vulnerabilityCount}</div>
                      <div className="text-sm text-muted-foreground">취약점</div>
                    </div>
                  </div>
                  {!simpleMode && ( <>
                      <div className="p-4 bg-secondary/50 rounded mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-medium text-secondary-foreground">노드 정보</h4>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="text-sm"><span className="text-muted-foreground">호스트:</span> {selectedNode.ip_address || selectedNode.label}</div>
                          <div className="text-sm"><span className="text-muted-foreground">상태:</span> {selectedNode.state || "알 수 없음"}</div>
                          <div className="text-sm"><span className="text-muted-foreground">OS:</span> {selectedNode.custom_data?.os || "알 수 없음"}</div>
                          <div className="text-sm"><span className="text-muted-foreground">유형:</span> {selectedNode.custom_data?.role === "central" ? "중앙 호스트" : "호스트"}</div>
                        </div>
                      </div>
                      {summary.hasServices && selectedNode.custom_data?.services && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg> 실행 중인 서비스
                          </h4>
                          <div className="flex flex-wrap gap-2">{selectedNode.custom_data.services.map((service: string, i: number) => (<Badge key={i} variant="outline">{service}</Badge>))}</div>
                        </div>
                      )}
                      {summary.highRiskCount > 0 && (
                        <div className="p-3 bg-destructive/10 rounded border border-destructive/20 mb-4">
                          <h4 className="text-sm font-medium flex items-center gap-1 text-destructive">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> 중요 취약점
                          </h4>
                          <p className="text-destructive">{summary.highRiskCount}개의 심각한 취약점이 발견되었습니다 (CVSS ≥ 7.0)</p>
                        </div>
                      )}
                  </> )}
                  {selectedNode.timestamp && (<div className="text-sm text-muted-foreground flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> 스캔 날짜: {new Date(selectedNode.timestamp).toLocaleString()}</div>)}
                  {selectedNode.report_id && (<a href={`/reports/${selectedNode.report_id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border border-input hover:bg-accent hover:text-accent-foreground w-full mt-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> 상세 리포트 보기</a>)}
                </div>
              );
            })()}
            
            {!selectedNode && (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                노드를 클릭하면 정보가 표시됩니다
              </div>
            )}
          </div>
        </div>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
              <DialogTitle>토폴로지에 리포트 추가</DialogTitle>
              <DialogDescription>토폴로지에 추가할 리포트를 선택하세요.</DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto p-1">
              {isFetchingReports ? (<p>리포트 목록을 불러오는 중입니다...</p>) : reportsForModal.length > 0 ? (
                <ul className="space-y-2">
                  {reportsForModal.map((report) => (
                    <li key={report.id} className="flex items-center justify-between p-2 border rounded-md">
                      <div>
                        <p className="font-semibold">{report.target || report.filename}</p>
                        <p className="text-sm text-muted-foreground">{new Date(report.timestamp).toLocaleString()}</p>
                      </div>
                      <Button size="sm" onClick={() => handleAddReportFromModal(report.id)}>추가</Button>
                    </li>
                  ))}
                </ul>
              ) : (<p>추가할 수 있는 리포트가 없습니다.</p>)}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>닫기</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default NetworkTopology;