import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { NodeData } from '../components/topology/Topology';
import TopologyDetailsPanel from '../components/topology/TopologyDetailsPanel';
import ScanForm from '../components/scan/ScanForm';
import './MainLayout.css';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [rightPanelContent, setRightPanelContent] = useState<'details' | 'scan'>('details');
  const [isPanelVisible, setIsPanelVisible] = useState<boolean>(true);

  const handleMenuItemClick = (view: 'main' | 'scan' | 'vpn' | 'test') => {
    if (view === 'scan') {
      setRightPanelContent('scan');
      setIsPanelVisible(true);
      navigate('/');
    } else if (view === 'vpn') {
      navigate('/vpn');
    } else if (view === 'test') {
      navigate('/test');
    } else {
      navigate('/');
      setRightPanelContent('details');
    }
  };

  const handleNodeSelect = (node: NodeData | null) => {
    setSelectedNode(node);
    if (node) {
      setRightPanelContent('details');
      setIsPanelVisible(true);
    }
  };

  const togglePanel = () => {
    setIsPanelVisible(!isPanelVisible);
  };

  return (
    <div className="main-layout">
      <Header onMenuItemClick={handleMenuItemClick} />
      <main className="main-content">
        <div className="main-view-content">
          <div className={`main-split-layout ${isPanelVisible ? 'panel-visible' : 'panel-hidden'}`}>
            <div className="topology-area">
              <Outlet context={{ onNodeSelect: handleNodeSelect }} />
              <button
                className="panel-toggle-btn"
                onClick={togglePanel}
                aria-label={isPanelVisible ? '패널 숨기기' : '패널 보이기'}
              >
                {isPanelVisible ? '>' : '<'}
              </button>
            </div>
            <div className={`details-area ${isPanelVisible ? 'visible' : 'hidden'}`}>
              {rightPanelContent === 'details' ? (
                <TopologyDetailsPanel selectedNode={selectedNode} />
              ) : (
                <ScanForm onNodeSelect={handleNodeSelect} />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout; 