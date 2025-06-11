import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { UserTopology, TopologyNode, TopologyEdge } from '../../types';

// 토폴로지 슬라이스 상태 타입
interface TopologyState {
  loading: boolean;
  error: string | null;
  userTopology: UserTopology | null;
  selectedNode: TopologyNode | null;
}

// 초기 상태 정의
const initialState: TopologyState = {
  loading: false,
  error: null,
  userTopology: null,
  selectedNode: null,
};

// 사용자 ID로 토폴로지 데이터를 로드하는 비동기 액션
// 실제 API 통신은 추후 구현
export const loadUserTopology = createAsyncThunk(
  'topology/loadUserTopology',
  async (userId: string, { rejectWithValue }) => {
    try {
      // 임시 구현: 로컬 스토리지에서 토폴로지 데이터 불러오기
      const storedTopology = localStorage.getItem(`topology_${userId}`);
      
      if (storedTopology) {
        const parsedTopology = JSON.parse(storedTopology) as UserTopology;
        
        // scanner 노드 제거 및 role 속성 추가/수정
        parsedTopology.nodes = parsedTopology.nodes
          // scanner 타입 노드 완전히 제거
          .filter(node => (node.type as any) !== 'scanner')
          .map(node => {
            // role 속성이 없는 경우 추가
            if (!node.custom_data) {
              node.custom_data = { role: node.id === 'main-host' ? 'central' : 'node' };
            } else if (!node.custom_data.role) {
              node.custom_data.role = node.id === 'main-host' ? 'central' : 'node';
            }
            return node;
          });
        
        // scanner 노드와 연결된 엣지도 제거
        if (parsedTopology.edges && parsedTopology.edges.length > 0) {
          const nodeIds = new Set(parsedTopology.nodes.map(node => node.id));
          parsedTopology.edges = parsedTopology.edges.filter(edge => 
            nodeIds.has(edge.source) && nodeIds.has(edge.target)
          );
        }
        
        // 중앙 호스트 노드가 없다면 추가
        if (!parsedTopology.nodes.some(node => node.id === 'main-host')) {
          parsedTopology.nodes.push({
            id: 'main-host',
            label: 'Host',
            type: 'host',
            state: 'up',
            description: 'Host 노드',
            custom_data: { role: 'central' }
          });
        }
        
        // 변경된 토폴로지 저장
        localStorage.setItem(`topology_${userId}`, JSON.stringify(parsedTopology));
        return parsedTopology;
      }
      
      // 데이터가 없으면 기본 토폴로지 생성 - 중앙 호스트 노드만 포함
      const defaultTopology: UserTopology = {
        user_id: userId,
        nodes: [{
          id: 'main-host',
          label: 'Host',
          type: 'host',
          ip_address: 'localhost',
          state: 'up',
          vulnerabilities_count: 0,
          high_risk_count: 0,
          description: 'Host 노드',
          custom_data: {
            role: 'central'
          }
        }],
        edges: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      // 기본 토폴로지 저장
      localStorage.setItem(`topology_${userId}`, JSON.stringify(defaultTopology));
      return defaultTopology;
    } catch (error: any) {
      return rejectWithValue(error.message || '토폴로지 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }
);

// 토폴로지에 노드 추가 비동기 액션
export const addNodeToTopology = createAsyncThunk(
  'topology/addNodeToTopology',
  async ({ userId, node, edges }: { userId: string, node: TopologyNode, edges?: TopologyEdge[] }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { topology: TopologyState };
      const currentTopology = state.topology.userTopology;
      
      if (!currentTopology) {
        return rejectWithValue('토폴로지 데이터가 없습니다. 먼저 토폴로지를 로드해주세요.');
      }
      
      // 이미 존재하는 노드인지 확인
      const existingNodeIndex = currentTopology.nodes.findIndex(n => n.id === node.id);
      
      let updatedNodes = [...currentTopology.nodes];
      if (existingNodeIndex >= 0) {
        // 기존 노드 업데이트
        updatedNodes[existingNodeIndex] = node;
      } else {
        // 새 노드 추가
        updatedNodes.push(node);
      }
      
      // 엣지 처리
      const updatedEdges = [...currentTopology.edges];
      if (edges && edges.length > 0) {
        edges.forEach(edge => {
          if (!updatedEdges.some(e => e.id === edge.id)) {
            updatedEdges.push(edge);
          }
        });
      }
      
      // 업데이트된 토폴로지
      const updatedTopology: UserTopology = {
        ...currentTopology,
        nodes: updatedNodes,
        edges: updatedEdges,
        updated_at: new Date().toISOString(),
      };
      
      // 로컬 스토리지에 저장
      localStorage.setItem(`topology_${userId}`, JSON.stringify(updatedTopology));
      
      return updatedTopology;
    } catch (error: any) {
      return rejectWithValue(error.message || '토폴로지에 노드를 추가하는 중 오류가 발생했습니다.');
    }
  }
);

// 스캔 결과를 토폴로지에 추가하는 비동기 액션
export const addScanToTopology = createAsyncThunk(
  'topology/addScanToTopology',
  async ({ userId, scanResult }: { userId: string, scanResult: any }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { topology: TopologyState };
      const currentTopology = state.topology.userTopology;
      
      if (!currentTopology) {
        return rejectWithValue('토폴로지 데이터가 없습니다. 먼저 토폴로지를 로드해주세요.');
      }
      
      // 새 노드들과 엣지들을 저장할 배열
      let newNodes: TopologyNode[] = [];
      let newEdges: TopologyEdge[] = [];
      
      // 스캔 호스트마다 노드 생성
      if (scanResult.hosts && scanResult.hosts.length > 0) {
        scanResult.hosts.forEach((host: any) => {
          // 이미 존재하는 노드인지 확인
          const existingNode = currentTopology.nodes.find(n => n.id === host.host);
          if (!existingNode) {
            // 호스트 노드 추가
            const hostNode: TopologyNode = {
              id: host.host,
              label: host.host,
              type: 'host',
              ip_address: host.host,
              state: host.state,
              vulnerabilities_count: 0, // 취약점 결과가 있으면 계산 필요
              high_risk_count: 0, // 취약점 결과가 있으면 계산 필요
              description: `스캔된 호스트: ${host.host}`,
              custom_data: {
                role: 'node',
                host: host,
                scan_id: scanResult.scan_id,
                timestamp: scanResult.timestamp
              }
            };
            
            newNodes.push(hostNode);
            
            // 중앙 호스트 노드와 연결하는 엣지 생성
            const edge: TopologyEdge = {
              id: `e-main-host-${host.host}`,
              source: 'main-host',
              target: host.host,
              label: 'scanned'
            };
            
            newEdges.push(edge);
          }
        });
      }
      
      // 업데이트된 토폴로지
      const updatedTopology: UserTopology = {
        ...currentTopology,
        nodes: [...currentTopology.nodes, ...newNodes],
        edges: [...currentTopology.edges, ...newEdges],
        updated_at: new Date().toISOString(),
      };
      
      // 로컬 스토리지에 저장
      localStorage.setItem(`topology_${userId}`, JSON.stringify(updatedTopology));
      
      return updatedTopology;
    } catch (error: any) {
      return rejectWithValue(error.message || '스캔 결과를 토폴로지에 추가하는 중 오류가 발생했습니다.');
    }
  }
);

// 토폴로지에서 노드 삭제 비동기 액션
export const removeNodeFromTopology = createAsyncThunk(
  'topology/removeNodeFromTopology',
  async ({ userId, nodeId }: { userId: string, nodeId: string }, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { topology: TopologyState };
      const currentTopology = state.topology.userTopology;
      
      if (!currentTopology) {
        return rejectWithValue('토폴로지 데이터가 없습니다. 먼저 토폴로지를 로드해주세요.');
      }
      
      // 중앙 호스트 노드는 삭제 불가
      if (nodeId === 'main-host') {
        return rejectWithValue('Host 노드는 삭제할 수 없습니다.');
      }
      
      // 노드 삭제
      const updatedNodes = currentTopology.nodes.filter(node => node.id !== nodeId);
      
      // 연결된 엣지 삭제
      const updatedEdges = currentTopology.edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      );
      
      // 업데이트된 토폴로지
      const updatedTopology: UserTopology = {
        ...currentTopology,
        nodes: updatedNodes,
        edges: updatedEdges,
        updated_at: new Date().toISOString(),
      };
      
      // 로컬 스토리지에 저장
      localStorage.setItem(`topology_${userId}`, JSON.stringify(updatedTopology));
      
      return updatedTopology;
    } catch (error: any) {
      return rejectWithValue(error.message || '토폴로지에서 노드를 삭제하는 중 오류가 발생했습니다.');
    }
  }
);

// 토폴로지 슬라이스 생성
const topologySlice = createSlice({
  name: 'topology',
  initialState,
  reducers: {
    // 선택된 노드 변경
    setSelectedNode: (state, action: PayloadAction<TopologyNode | null>) => {
      state.selectedNode = action.payload;
    },
    // 오류 상태 초기화
    resetTopologyError: (state) => {
      state.error = null;
    },
    // 토폴로지 데이터 초기화
    clearTopology: (state) => {
      state.userTopology = null;
      state.selectedNode = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 사용자 토폴로지 로드
      .addCase(loadUserTopology.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadUserTopology.fulfilled, (state, action: PayloadAction<UserTopology>) => {
        state.loading = false;
        state.userTopology = action.payload;
      })
      .addCase(loadUserTopology.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 노드 추가
      .addCase(addNodeToTopology.fulfilled, (state, action: PayloadAction<UserTopology>) => {
        state.userTopology = action.payload;
      })
      // 스캔 결과 추가
      .addCase(addScanToTopology.fulfilled, (state, action: PayloadAction<UserTopology>) => {
        state.userTopology = action.payload;
      })
      // 노드 삭제
      .addCase(removeNodeFromTopology.fulfilled, (state, action: PayloadAction<UserTopology>) => {
        state.userTopology = action.payload;
      });
  },
});

// 액션 내보내기
export const { setSelectedNode, resetTopologyError, clearTopology } = topologySlice.actions;

// 리듀서 내보내기
export default topologySlice.reducer; 