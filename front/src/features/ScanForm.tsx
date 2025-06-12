import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useAppDispatch } from '../store/hooks';
import { setCurrentScan } from '../store/slices/scanSlice';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '../components/ui/alert';
import { AlertCircle } from 'lucide-react';
import axios from 'axios';
import { HostInfo } from '../types';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const scanTypeOptions = [
  { value: '-sC -sV', label: '빠른 스캔 (-sC -sV)' },
  { value: '-sV', label: '버전 감지 (-sV)' },
  { value: '-sS', label: 'SYN 스캔 (-sS)' },
  { value: '-sT', label: 'TCP 연결 스캔 (-sT)' },
  { value: '-sU', label: 'UDP 스캔 (-sU)' },
  { value: '-A', label: '공격적 스캔 (-A)' },
];

const ScanForm: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const [target, setTarget] = useState('');
  const [ports, setPorts] = useState('1-1000');
  const [scanType, setScanType] = useState('-sC -sV');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('스캔 요청 전송:', {
        target: target.trim(), 
        ports: ports.trim() || "1-1000", 
        arguments: scanType
      });
      
      const response = await axios.post(`${API_URL}/scan`, {
        target: target.trim(),
        ports: ports.trim() || "1-1000",
        arguments: scanType
      });
      
      console.log('스캔 결과 받음:', response.data);
      
      // 스캔 결과가 비어있는지 확인
      if (!response.data.hosts || response.data.hosts.length === 0) {
        console.log('스캔 결과: 호스트에서 응답이 없거나 열린 포트를 찾지 못함');
      } else {
        const totalPorts = response.data.hosts.reduce(
          (sum: number, host: HostInfo) => sum + (host.ports ? host.ports.length : 0), 0
        );
        console.log(`스캔 결과: ${response.data.hosts.length}개 호스트, ${totalPorts}개 포트 발견`);
      }
      
      // Redux 스토어에 결과 저장
      dispatch(setCurrentScan(response.data));
      
      // 결과가 성공적으로 저장되었다면 결과 페이지로 이동
      if (response.data && response.data.scan_id) {
        navigate(`/results/${response.data.scan_id}`);
      } else {
        // scan_id가 없는 경우에도 결과를 표시해야 함
        navigate(`/results/latest`);
      }
      
    } catch (err: any) {
      console.error('스캔 오류:', err);
      setError(err.response?.data?.error || err.message || '스캔 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>네트워크 스캔</CardTitle>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label htmlFor="target" className="text-sm font-medium">대상 IP/호스트</label>
              <Input
                id="target"
                type="text"
                placeholder="예: 192.168.1.1 또는 example.com"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="ports" className="text-sm font-medium">포트 범위</label>
              <Input
                id="ports"
                type="text"
                placeholder="예: 1-1000 또는 80,443,8080 (비워두면 기본값 1-1000)"
                value={ports}
                onChange={(e) => setPorts(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                비워두면 기본 포트 범위(1-1000)가 사용됩니다.
              </p>
            </div>
            
            <div className="grid gap-2">
              <label htmlFor="scanType" className="text-sm font-medium">스캔 유형</label>
              <Select
                value={scanType}
                onValueChange={setScanType}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="스캔 유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  {scanTypeOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                {scanType === '-sC -sV' && '스크립트와 버전 감지를 결합한 빠른 스캔'}
                {scanType === '-sV' && '포트에서 실행 중인 서비스의 버전 감지'}
                {scanType === '-sS' && 'TCP SYN 스캔 (반연결 스캔)'}
                {scanType === '-sT' && '전체 TCP 연결 스캔 (기본 스캔)'}
                {scanType === '-sU' && 'UDP 프로토콜 스캔 (시간이 오래 걸릴 수 있음)'}
                {scanType === '-A' && '운영체제 감지, 버전 감지, 스크립트 검색을 포함한 공격적 스캔'}
              </p>
            </div>
          </div>
        </form>
      </CardContent>
      
      <CardFooter>
        <Button 
          type="submit" 
          onClick={handleSubmit} 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? '스캔 중...' : '스캔 시작'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ScanForm; 