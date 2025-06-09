import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
// import CytoscapeComponent from 'react-cytoscapejs';
import cytoscape, { EdgeSingular, NodeSingular } from 'cytoscape';
import { RootState } from '../store';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { HostInfo, Vulnerability, ScanResult, PortInfo } from '../types';

// 임시로 CytoscapeComponent를 대체할 인터페이스 정의
interface CytoscapeComponentProps {
  elements: any[];
  style: React.CSSProperties;
  cy: (cy: any) => void;
}

const CytoscapeComponent: React.FC<CytoscapeComponentProps> = () => <div>Cytoscape 컴포넌트</div>;

const NetworkTopology: React.FC = () => {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const { currentScan } = useSelector((state: RootState) => state.scan);
  const { currentVulnerability } = useSelector((state: RootState) => state.vulnerability);
  
  const [selectedNode, setSelectedNode] = useState<HostInfo | null>(null);
  const [selectedVulnerabilities, setSelectedVulnerabilities] = useState<Vulnerability[]>([]);
  
  // 토폴로지 맵의 Elements 생성
  const generateElements = () => {
    if (!currentScan) return { nodes: [], edges: [] };
    
    const nodes = currentScan.hosts.map((host: HostInfo, index: number) => ({
      data: {
        id: host.host,
        label: host.host,
        type: 'host',
        state: host.state,
        os: host.os.name,
        ports: host.ports.filter((port: PortInfo) => port.state === 'open').length,
        vulnCount: getVulnCountForHost(host.host),
        highRiskCount: getHighRiskVulnCountForHost(host.host)
      }
    }));
    
    // 중앙에 스캐너 노드 추가
    nodes.unshift({
      data: {
        id: 'scanner',
        label: 'Scanner',
        type: 'scanner',
        // 타입 오류를 해결하기 위해 필요한 필드 추가
        state: 'up',
        os: 'scanner',
        ports: 0,
        vulnCount: 0,
        highRiskCount: 0
      }
    });
    
    // 스캐너에서 호스트로의 엣지 생성
    const edges = currentScan.hosts.map((host: HostInfo, index: number) => ({
      data: {
        id: `e-scanner-${host.host}`,
        source: 'scanner',
        target: host.host,
        label: 'scanned'
      }
    }));
    
    return { nodes, edges };
  };
  
  // 호스트별 CVE 취약점 수 계산
  const getVulnCountForHost = (hostId: string) => {
    if (!currentVulnerability) return 0;
    
    const host = currentVulnerability.hosts.find((h: HostInfo) => h.host === hostId);
    if (!host) return 0;
    
    return host.ports.reduce((count: number, port: any) => 
      count + (port.vulnerabilities?.length || 0), 0);
  };
  
  // 높은 위험도(CVSS >= 7.0)의 취약점 수 계산
  const getHighRiskVulnCountForHost = (hostId: string) => {
    if (!currentVulnerability) return 0;
    
    const host = currentVulnerability.hosts.find((h: HostInfo) => h.host === hostId);
    if (!host) return 0;
    
    return host.ports.reduce((count: number, port: any) => {
      if (!port.vulnerabilities) return count;
      return count + port.vulnerabilities.filter((vuln: Vulnerability) => vuln.cvss_score >= 7.0).length;
    }, 0);
  };
  
  // 호스트 클릭시 CVE 정보 표시
  const handleNodeClick = (hostId: string) => {
    if (hostId === 'scanner' || !currentVulnerability) {
      setSelectedNode(null);
      setSelectedVulnerabilities([]);
      return;
    }
    
    const host = currentVulnerability.hosts.find((h: HostInfo) => h.host === hostId);
    if (!host) return;
    
    setSelectedNode(host);
    
    // 모든 취약점 가져오기
    const vulnerabilities: Vulnerability[] = [];
    host.ports.forEach((port: any) => {
      if (port.vulnerabilities) {
        vulnerabilities.push(...port.vulnerabilities);
      }
    });
    
    // CVSS 점수 내림차순으로 정렬
    setSelectedVulnerabilities(
      vulnerabilities.sort((a, b) => b.cvss_score - a.cvss_score)
    );
  };
  
  // 노드 스타일 설정 (취약점에 따라 색상 변경)
  useEffect(() => {
    if (cyRef.current) {
      const cy = cyRef.current;
      
      // 스타일 초기화
      cy.style()
        .selector('node[type="scanner"]')
        .style({
          'background-color': '#3b82f6',
          'label': 'data(label)',
          'width': 60,
          'height': 60,
          'font-size': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6 // 문자열에서 숫자로 변경
        })
        .selector('node[type="host"]')
        .style({
          'background-color': (ele: NodeSingular) => {
            const vulnCount = ele.data('highRiskCount');
            if (vulnCount > 3) return '#ef4444'; // 높은 위험
            if (vulnCount > 0) return '#f97316'; // 중간 위험
            return '#22c55e'; // 낮은 위험
          },
          'label': 'data(label)',
          'width': 50,
          'height': 50,
          'font-size': 12,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6 // 문자열에서 숫자로 변경
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
    }
  }, [currentVulnerability]);
  
  // CVSS 점수에 따른 색상 스타일
  const getCvssSeverity = (score: number) => {
    if (score >= 9) return 'destructive';
    if (score >= 7) return 'destructive';
    if (score >= 4) return 'warning';
    return 'success';
  };
  
  const elements = generateElements();
  
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>네트워크 토폴로지</CardTitle>
      </CardHeader>
      <CardContent className="grid lg:grid-cols-2 gap-6">
        <div className="w-full h-[500px] border rounded">
          {currentScan && elements.nodes.length > 0 ? (
            <CytoscapeComponent
              elements={[...elements.nodes, ...elements.edges]}
              style={{ width: '100%', height: '100%' }}
              cy={(cytoscapeInstance: any) => { 
                cyRef.current = cytoscapeInstance;
                cytoscapeInstance.on('tap', 'node', (event: any) => {
                  const nodeId = event.target.id();
                  handleNodeClick(nodeId);
                });
                
                // 자동 레이아웃 적용
                cytoscapeInstance.layout({ 
                  name: 'concentric',
                  minNodeSpacing: 100,
                  concentric: function(node: any) {
                    return node.data('type') === 'scanner' ? 10 : 1;
                  }
                }).run();
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              스캔 결과가 없습니다. 네트워크를 스캔해주세요.
            </div>
          )}
        </div>
        
        <div className="w-full h-[500px] overflow-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {selectedNode.host} 
                <Badge className="ml-2" variant={selectedNode.state === 'up' ? 'success' : 'destructive'}>
                  {selectedNode.state}
                </Badge>
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-secondary/50 rounded">
                  <div className="text-2xl font-bold">{selectedNode.ports.filter(p => p.state === 'open').length}</div>
                  <div className="text-sm text-muted-foreground">열린 포트</div>
                </div>
                <div className="p-4 bg-secondary/50 rounded">
                  <div className="text-2xl font-bold">{selectedVulnerabilities.length}</div>
                  <div className="text-sm text-muted-foreground">취약점</div>
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-semibold mb-2">발견된 취약점</h4>
                
                {selectedVulnerabilities.length > 0 ? (
                  <div className="space-y-2">
                    {selectedVulnerabilities.map((vuln, index) => (
                      <Alert key={index} variant="default" className="mb-3">
                        <div className="flex justify-between items-center">
                          <AlertTitle>{vuln.cve_id}</AlertTitle>
                          <Badge variant={getCvssSeverity(vuln.cvss_score)}>
                            CVSS: {vuln.cvss_score.toFixed(1)}
                          </Badge>
                        </div>
                        <AlertDescription>
                          <div className="font-medium mt-2">{vuln.title}</div>
                          <div className="text-sm mt-1">{vuln.description}</div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">취약점이 발견되지 않았습니다.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              호스트를 선택하여 상세 정보를 확인하세요.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NetworkTopology; 