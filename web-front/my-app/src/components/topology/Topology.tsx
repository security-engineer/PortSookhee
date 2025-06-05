import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape, { ElementsDefinition } from 'cytoscape';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import './Topology.css';
import TopologyDetailsPanel from './TopologyDetailsPanel';
import { useOutletContext, useLocation } from 'react-router-dom';

/**
 * Topology.tsx – fully‑working, self‑debugging demo.
 * Renders a 3‑node topology and logs lifecycle events so you can see what happens.
 */
export interface NodeData {
  id: string;
  type: 'host' | 'router' | 'switch';
  name: string;
  ip?: string;
  nmapData?: {
    hostname?: string;
    mac?: string;
    macVendor?: string;
    os?: {
      name?: string;
      version?: string;
      accuracy?: number;
    };
    ports?: {
      port: number;
      protocol: 'tcp' | 'udp';
      state: 'open' | 'closed' | 'filtered';
      service: string;
      product?: string;
      version?: string;
    }[];
    scripts?: {
      name: string;
      output: string;
    }[];
    uptime?: {
      seconds: number;
      lastBoot?: string;
    };
    distance?: number;
    tcpSequence?: {
      class: string;
      difficulty: string;
    };
    lastScanTime?: string;
  };
  vulnerabilities?: {
    severity: 'high' | 'medium' | 'low';
    description: string;
    cve?: string;
  }[];
}

type LayoutType = 'grid' | 'circle';
type NodeShape = 'ellipse' | 'triangle' | 'rectangle' | 'diamond' | 'hexagon' | 'octagon' | 'vee' | 'rhomboid';

// Constants
const NODE_SIZES = {
  host: { width: 40, height: 40 },
  router: { width: 50, height: 50 },
  switch: { width: 45, height: 45 }
} as const;

const SAMPLE_VULNERABILITIES = [
  {
    severity: 'high' as const,
    description: 'Open SSH port (22)',
    cve: 'CVE-2023-1234'
  },
  {
    severity: 'medium' as const,
    description: 'Outdated OpenSSL version',
    cve: 'CVE-2023-5678'
  },
  {
    severity: 'low' as const,
    description: 'Default credentials in use'
  }
];

interface OutletContextType {
  onNodeSelect: (node: NodeData | null) => void;
}

interface TopologyProps {
  initialElements?: ElementsDefinition;
}

const Topology: React.FC<TopologyProps> = ({ initialElements }) => {
  const { onNodeSelect } = useOutletContext<OutletContextType>();
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<LayoutType>('grid');
  const [nodeShapes, setNodeShapes] = useState<Record<string, NodeShape>>({
    host: 'ellipse',
    router: 'diamond',
    switch: 'rectangle'
  });
  const [elements, setElements] = useState<ElementsDefinition>(() => {
    // localStorage에서 저장된 노드 읽어오기
    const savedNodes = JSON.parse(localStorage.getItem('topologyNodes') || '[]');
    const nodes = savedNodes.map((node: NodeData) => ({
      data: node
    }));
    
    // 기본 노드 추가 (저장된 노드가 없을 경우)
    if (nodes.length === 0) {
      nodes.push({ data: { id: 'myhost', name: 'My Host', type: 'host', ip: '127.0.0.1' } });
    }
    
    return {
      nodes: nodes,
      edges: [],
    };
  });
  const cyRef = useRef<cytoscape.Core | null>(null);

  // Layout options
  const layoutOptions = {
    grid: {
      name: 'grid',
      fit: true,
      padding: 150,
      rows: 3,
      cols: 3,
      nodeDimensionsIncludeLabels: true
    },
    circle: {
      name: 'circle',
      fit: true,
      padding: 150,
      radius: 400,
      startAngle: 0,
      sweep: 360,
      clockwise: true,
      nodeDimensionsIncludeLabels: true
    },
  };

  // 커스텀 이벤트 리스너 추가
  useEffect(() => {
    const handleNodeAdded = (event: CustomEvent) => {
      const newNode = event.detail.node;
      
      if (cyRef.current) {
        const existingNode = cyRef.current.getElementById(newNode.id);
        if (existingNode.length === 0) {
          cyRef.current.add({
            data: newNode
          });
          
          // 레이아웃 다시 실행
          cyRef.current.layout(layoutOptions[layout]).run();
          
          // 새로 추가된 노드 선택
          setTimeout(() => {
            const addedNode = cyRef.current?.getElementById(newNode.id);
            if (addedNode) {
              addedNode.select();
            }
          }, 500);
        }
      }
    };
    
    window.addEventListener('topologyNodeAdded', handleNodeAdded as EventListener);
    
    return () => {
      window.removeEventListener('topologyNodeAdded', handleNodeAdded as EventListener);
    };
  }, [layout, layoutOptions]);

  // Initialize Cytoscape
  const initCytoscape = useCallback(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      minZoom: 0.2,
      maxZoom: 2.5,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      wheelSensitivity: 0.3,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#A5B4FC',
            'label': 'data(name)',
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'font-size': '12px',
            'color': '#374151',
            'padding': '10px',
            'min-zoomed-font-size': 8,
            'text-outline-width': 0,
            'text-margin-y': 10,
          }
        },
        {
          selector: 'node[type="host"]',
          style: {
            'background-color': '#6EE7B7',
            'shape': nodeShapes.host,
            'width': NODE_SIZES.host.width,
            'height': NODE_SIZES.host.height,
            'border-width': 2,
            'border-color': '#059669'
          }
        },
        {
          selector: 'node[type="router"]',
          style: {
            'background-color': '#93C5FD',
            'shape': nodeShapes.router,
            'width': NODE_SIZES.router.width,
            'height': NODE_SIZES.router.height,
            'border-width': 2,
            'border-color': '#3B82F6'
          }
        },
        {
          selector: 'node[type="switch"]',
          style: {
            'background-color': '#FCD34D',
            'shape': nodeShapes.switch,
            'width': NODE_SIZES.switch.width,
            'height': NODE_SIZES.switch.height,
            'border-width': 2,
            'border-color': '#F59E0B'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#9CA3AF',
            'target-arrow-color': '#9CA3AF',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.5
          }
        },
        {
          selector: ':selected',
          style: {
            'border-width': 3,
            'border-color': '#4F46E5',
            'line-color': '#4F46E5',
            'target-arrow-color': '#4F46E5'
          }
        }
      ]
    });

    return cy;
  }, [nodeShapes, elements]);

  // Setup event handlers
  const setupEventHandlers = useCallback((cy: cytoscape.Core) => {
    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const nodeData: NodeData = node.data();
      onNodeSelect(nodeData);
    });

    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onNodeSelect(null);
      }
    });
  }, [onNodeSelect]);

  // Initialize graph
  useEffect(() => {
    const cy = initCytoscape();
    if (!cy) return;

    cyRef.current = cy;
    setupEventHandlers(cy);
    cy.layout(layoutOptions[layout]).run();

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [initCytoscape, setupEventHandlers, layout, elements, layoutOptions]);

  // Update layout when changed
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.layout(layoutOptions[layout]).run();
    }
  }, [layout, layoutOptions]);

  // Update Cytoscape elements when initialElements prop changes
  useEffect(() => {
    if (cyRef.current && initialElements) {
      cyRef.current.elements().remove();
      cyRef.current.add(initialElements);
      cyRef.current.layout(layoutOptions[layout]).run();
    }
  }, [initialElements, layout]);

  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayout(newLayout);
  };

  const handleNodeShapeChange = (type: string, shape: NodeShape) => {
    setNodeShapes(prevShapes => ({
      ...prevShapes,
      [type]: shape
    }));
  };

  const handleClearTopology = () => {
    if (window.confirm('토폴로지의 모든 노드를 삭제하시겠습니까?')) {
      localStorage.removeItem('topologyNodes');
      if (cyRef.current) {
        cyRef.current.elements().remove();
      }
      setElements({ nodes: [], edges: [] });
    }
  };

  return (
    <div className="topology-container">
      <div className="controls-panel">
        <h4>레이아웃</h4>
        <button onClick={() => handleLayoutChange('grid')} disabled={layout === 'grid'}>그리드</button>
        <button onClick={() => handleLayoutChange('circle')} disabled={layout === 'circle'}>원형</button>
        <button onClick={handleClearTopology} className="clear-btn">초기화</button>
      </div>
      <div ref={containerRef} className="topology-graph" />
    </div>
  );
};

export default Topology; 