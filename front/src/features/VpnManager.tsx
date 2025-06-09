import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { 
  fetchConfigs, 
  uploadConfig, 
  deleteConfig, 
  connectVpn,
  disconnectVpn,
  fetchStatus,
  clearUploadResult,
  clearError
} from '../store/slices/vpnSlice';
import { formatBytes, formatDate } from '../lib/utils';
import { useAppDispatch } from '../store/hooks';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert, AlertDescription } from "../components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "../components/ui/table";
import axios from 'axios';
import { Badge } from "../components/ui/badge";

// API URL 상수 정의
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const VpnManager: React.FC = () => {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { configs, status, loading, error, uploadResult } = useSelector((state: RootState) => state.vpn);
  const [statusCheckInterval, setStatusCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [vpnLog, setVpnLog] = useState<string>("");
  const [showLog, setShowLog] = useState<boolean>(false);
  
  // 초기 데이터 로드
  useEffect(() => {
    dispatch(fetchConfigs());
    dispatch(fetchStatus());
    
    // 5초마다 상태 갱신
    const interval = setInterval(() => {
      dispatch(fetchStatus());
    }, 5000);
    
    setStatusCheckInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dispatch]);
  
  // 파일 선택 핸들러
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      await dispatch(uploadConfig(selectedFile));
      
      // 업로드 성공 후 목록 갱신
      if (!error) {
        setTimeout(() => {
          dispatch(fetchConfigs());
        }, 500);
      }
      
      // 파일 인풋 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  // 설정 파일 삭제 핸들러
  const handleDelete = async (configName: string) => {
    if (window.confirm(`'${configName}' 설정 파일을 삭제하시겠습니까?`)) {
      await dispatch(deleteConfig(configName));
      dispatch(fetchConfigs());
    }
  };
  
  // VPN 연결 핸들러
  const handleConnect = async (configName: string) => {
    await dispatch(connectVpn(configName));
    dispatch(fetchStatus());
  };
  
  // VPN 연결 종료 핸들러
  const handleDisconnect = async () => {
    await dispatch(disconnectVpn());
    dispatch(fetchStatus());
  };
  
  // VPN 로그 확인
  const handleViewLog = async () => {
    try {
      const response = await axios.get(`${API_URL}/vpn/log`);
      setVpnLog(response.data.log);
      setShowLog(true);
    } catch (error) {
      console.error('VPN 로그 조회 오류:', error);
    }
  };
  
  const InfoItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm text-gray-900 dark:text-white font-mono">{value || 'N/A'}</span>
    </div>
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">VPN 연결 관리</h1>
      
      {/* 연결 상태 표시 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>VPN 연결 상태</CardTitle>
          <CardDescription>현재 VPN 연결 정보</CardDescription>
        </CardHeader>
        <CardContent>
          {status ? (
            <div className="space-y-2">
              <InfoItem 
                label="상태" 
                value={<Badge variant={status.status === 'connected' ? 'default' : 'destructive'}>{status.status}</Badge>} 
              />
              <InfoItem label="연결 프로필" value={status.profile_name} />
              <InfoItem label="OVPN 파일" value={status.config} />
              <InfoItem label="IP 주소" value={status.connection_info?.local_ip} />
              <InfoItem label="게이트웨이" value={status.connection_info?.gateway} />
              <InfoItem label="DNS" value={status.connection_info?.dns?.join(', ')} />
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400">
              VPN 상태 정보를 불러오는 중...
            </div>
          )}
        </CardContent>
        <CardFooter>
          {status && status.status === 'connected' ? (
            <Button 
              onClick={handleDisconnect} 
              variant="destructive"
              disabled={loading}
            >
              VPN 연결 종료
            </Button>
          ) : (
            <Button 
              disabled={true} 
              variant="outline"
            >
              연결되지 않음
            </Button>
          )}
        </CardFooter>
      </Card>
      
      {/* VPN 로그 모달 */}
      {showLog && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>OpenVPN 로그</CardTitle>
            <button 
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => setShowLog(false)}
            >
              ✕
            </button>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded max-h-96 overflow-auto">
              <pre className="whitespace-pre-wrap text-xs">
                {vpnLog || "로그 정보가 없습니다."}
              </pre>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* 오류 메시지 */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* 업로드 성공 메시지 */}
      {uploadResult && uploadResult.status === 'success' && (
        <Alert className="mb-4 bg-green-50 border-green-200">
          <AlertDescription>{uploadResult.message}</AlertDescription>
        </Alert>
      )}
      
      {/* 설정 파일 업로드 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>VPN 설정 업로드</CardTitle>
          <CardDescription>OpenVPN 설정 파일(.ovpn)을 업로드하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              type="file"
              ref={fileInputRef}
              accept=".ovpn"
              onChange={handleFileChange}
              disabled={loading}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* 설정 파일 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>VPN 설정 파일 목록</CardTitle>
          <CardDescription>저장된 VPN 설정 파일들</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>파일명</TableHead>
                <TableHead>크기</TableHead>
                <TableHead>수정일</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    저장된 VPN 설정 파일이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((config) => (
                  <TableRow key={config.name}>
                    <TableCell>{config.name}</TableCell>
                    <TableCell>{formatBytes(config.size)}</TableCell>
                    <TableCell>{formatDate(new Date(config.modified * 1000))}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleConnect(config.name)}
                          disabled={loading || (status?.status === 'connected' && status?.config === config.name)}
                        >
                          연결
                        </Button>
                        <Button 
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(config.name)}
                          disabled={loading || (status?.status === 'connected' && status?.config === config.name)}
                        >
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default VpnManager; 