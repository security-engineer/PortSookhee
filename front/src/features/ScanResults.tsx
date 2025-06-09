import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import { analyzeVulnerabilities } from '../store/slices/vulnerabilitySlice';
import { fetchScanById } from '../store/slices/scanSlice';
import { RootState } from '../store';
import { HostInfo, PortInfo } from '../types';
import { useAppDispatch } from '../store/hooks';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import axios from 'axios';

// API 기본 URL 설정
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ScanResults: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { scanId } = useParams<{ scanId: string }>();
  
  // scanSlice의 상태를 올바르게 참조하도록 수정
  const { currentScan, loading, error: scanError } = useSelector((state: RootState) => {
    console.log('Redux 상태 확인:', {
      currentScan: state.scan.currentScan,
      loading: state.scan.loading,
      error: state.scan.error
    });
    return state.scan;
  });
  const { currentVulnerability, loading: vulnLoading } = useSelector((state: RootState) => state.vulnerability);
  const [localError, setLocalError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  // 페이지 로드 시 scanId가 있으면 해당 스캔 데이터를 로드
  useEffect(() => {
    const loadScanData = async () => {
      if (scanId) {
        console.log(`스캔 ID(${scanId})로 스캔 결과 로딩 시도... (재시도: ${retryCount})`);
        try {
          // Redux 액션 디스패치 전에 직접 API 호출로 확인
          try {
            const directResponse = await axios.get(`${API_URL}/scans/${scanId}`);
            console.log('직접 API 호출 결과:', directResponse);
            setDebugInfo({
              api_response: {
                status: directResponse.status,
                data_exists: !!directResponse.data,
                data_type: typeof directResponse.data,
                has_hosts: Array.isArray(directResponse.data?.hosts),
                hosts_length: directResponse.data?.hosts?.length,
                scan_id: directResponse.data?.scan_id || '없음 (URL의 ID 사용 필요)'
              }
            });
          } catch (apiError: any) {
            console.error('직접 API 호출 오류:', apiError);
            setDebugInfo({
              api_error: {
                message: apiError.message,
                status: apiError.response?.status,
                data: apiError.response?.data
              }
            });
          }

          // Redux 액션을 통한 데이터 로드
          const resultAction = await dispatch(fetchScanById(scanId)).unwrap();
          console.log('스캔 결과 로드 성공:', resultAction);
          console.log('현재 Redux 상태의 currentScan:', currentScan);
          
          // 3초 후에 Redux 상태를 다시 확인
          setTimeout(() => {
            console.log('3초 후 Redux 상태 재확인:', {
              currentScan: currentScan,
              scan_id: currentScan?.scan_id
            });
          }, 3000);
        } catch (error: any) {
          console.error('스캔 결과 로드 실패:', error);
          setLocalError(`스캔 결과를 불러오는데 실패했습니다. 오류: ${JSON.stringify(error)}`);
        }
      }
    };
    
    console.log('현재 scanId:', scanId);
    console.log('현재 currentScan:', currentScan);
    
    // 이미 currentScan이 있고 scanId와 일치하면 다시 로드하지 않음
    if (!currentScan || (scanId && currentScan.scan_id !== scanId)) {
      console.log('스캔 결과 로드 시작...');
      loadScanData();
    } else {
      console.log('이미 스캔 결과가 로드되어 있습니다:', currentScan.scan_id);
    }
  }, [scanId, dispatch, currentScan, retryCount]);
  
  // 재시도 함수
  const handleRetry = () => {
    setRetryCount(prevCount => prevCount + 1);
  };
  
  // 취약점 분석 결과가 있으면 결과 페이지로 이동
  useEffect(() => {
    if (currentVulnerability && !vulnLoading) {
      console.log('취약점 분석 결과 확인됨, 결과 페이지로 이동합니다.');
      if (scanId) {
        navigate(`/vulnerabilities/${scanId}`);
      } else {
        navigate('/vulnerabilities/latest');
      }
    }
  }, [currentVulnerability, vulnLoading, navigate, scanId]);
  
  console.log('렌더링 상태:', { 
    loading, 
    scanError, 
    localError, 
    currentScan: !!currentScan,
    scanId,
    currentScanId: currentScan?.scan_id
  });
  
  // 로딩 중이거나 에러 상태 표시
  if (loading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>스캔 결과 로드 중...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded bg-secondary text-secondary-foreground">
            스캔 결과를 불러오는 중입니다. 잠시만 기다려주세요.
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (scanError || localError) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>스캔 결과 불러오기 실패</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{scanError || localError}</AlertDescription>
          </Alert>
          
          {debugInfo && (
            <div className="mt-4 p-4 border rounded bg-gray-100">
              <h4 className="text-sm font-medium mb-2">디버깅 정보:</h4>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
          
          <Button 
            className="mt-4" 
            onClick={() => navigate('/history')}
          >
            스캔 기록으로 돌아가기
          </Button>
          
          <Button 
            className="mt-4 ml-2" 
            variant="outline" 
            onClick={handleRetry}
          >
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentScan) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>스캔 결과 없음</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded bg-secondary text-secondary-foreground">
            표시할 스캔 결과가 없습니다. 스캔 ID가 올바른지 확인하세요.
          </div>
          
          {debugInfo && (
            <div className="mt-4 p-4 border rounded bg-gray-100">
              <h4 className="text-sm font-medium mb-2">디버깅 정보:</h4>
              <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded">
            <p className="text-sm">
              <strong>스캔 ID:</strong> {scanId}
            </p>
          </div>
          
          <Button 
            className="mt-4" 
            onClick={() => navigate('/history')}
          >
            스캔 기록으로 돌아가기
          </Button>
          
          <Button 
            className="mt-4 ml-2" 
            variant="outline" 
            onClick={handleRetry}
          >
            다시 시도
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  const handleAnalyzeVulnerabilities = () => {
    if (currentScan) {
      console.log('취약점 분석 요청 전송');
      dispatch(analyzeVulnerabilities({ scanResults: currentScan }));
    }
  };
  
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>스캔 결과</CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">대상: {currentScan.target}</h3>
          <p className="text-sm text-muted-foreground">
            스캔 시간: {currentScan.timestamp ? new Date(currentScan.timestamp).toLocaleString() : '알 수 없음'}
          </p>
          <p className="text-sm text-muted-foreground">
            스캔 ID: {currentScan.scan_id || scanId || '알 수 없음'}
          </p>
        </div>
        
        {currentScan.hosts.length === 0 ? (
          <div className="p-4 border rounded bg-secondary text-secondary-foreground">
            결과 없음. 호스트를 찾을 수 없거나 접근할 수 없습니다.
          </div>
        ) : (
          <>
            {currentScan.hosts.map((host: HostInfo, index: number) => (
              <div key={index} className="mb-6 border-b pb-4">
                <h3 className="text-lg font-medium">{host.host}</h3>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <span className="text-sm font-medium">상태:</span>{' '}
                    <Badge variant={host.state === 'up' ? 'success' : 'destructive'}>
                      {host.state}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium">OS:</span>{' '}
                    {host.os.name} (정확도: {host.os.accuracy})
                  </div>
                </div>
                
                <h4 className="text-md font-medium mt-3 mb-2">포트</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>포트</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>서비스</TableHead>
                        <TableHead>버전</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {host.ports.map((port: PortInfo, portIndex: number) => (
                        <TableRow key={portIndex}>
                          <TableCell>{port.port}</TableCell>
                          <TableCell>
                            <Badge variant={port.state === 'open' ? 'success' : 'secondary'}>
                              {port.state}
                            </Badge>
                          </TableCell>
                          <TableCell>{port.service}</TableCell>
                          <TableCell>{port.product} {port.version}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </>
        )}
      </CardContent>
      
      {currentScan.hosts.length > 0 && (
        <CardFooter>
          <Button 
            className="w-full" 
            onClick={handleAnalyzeVulnerabilities} 
            disabled={loading || vulnLoading}
          >
            {vulnLoading ? '분석 중...' : '취약점 분석'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default ScanResults; 