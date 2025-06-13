import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { fetchScanById, clearCurrentScan } from '../store/slices/scanSlice';
import { fetchReportById, clearCurrentReport } from '../store/slices/reportSlice';
import { clearVulnerabilityResults } from '../store/slices/vulnerabilitySlice';
import { AlertCircle, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { useAppDispatch } from '../store/hooks';

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// 타입 정의
interface ScanMeta {
  id: string;
  timestamp: string;
  target: string;
}

interface ReportMeta {
  id: string;
  timestamp: string;
  summary: {
    risk_level: string;
    vulnerabilities_found?: number;
    total_vulnerabilities?: number;
    target_ips?: string[];  // 타겟 IP 목록 추가
  };
}

const ScanHistory: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [scanList, setScanList] = useState<ScanMeta[]>([]);
  const [reportList, setReportList] = useState<ReportMeta[]>([]);
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  
  // 현재 리덕스 스토어에서 현재 리포트 상태 가져오기
  const currentReport = useSelector((state: RootState) => state.report.currentReport);
  
  // API에서 스캔 목록 가져오기
  const fetchScanList = async () => {
    setIsLoadingScans(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/scans`);
      if (response.data && response.data.scans) {
        setScanList(response.data.scans);
      }
    } catch (error) {
      console.error('스캔 목록 가져오기 실패:', error);
      setError('스캔 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoadingScans(false);
    }
  };
  
  // API에서 리포트 목록 가져오기
  const fetchReportList = async () => {
    setIsLoadingReports(true);
    setError(null);
    
    try {
      const response = await axios.get(`${API_URL}/reports`);
      if (response.data && response.data.reports) {
        // 각 리포트의 summary 필드 확인 및 null/undefined 처리
        const processedReports = response.data.reports.map((report: any) => {
          // summary 필드가 없는 경우 빈 객체로 초기화
          if (!report.summary) report.summary = {};
          
          // 필요한 필드들이 없는 경우 기본값 설정
          report.summary.vulnerabilities_found = report.summary.vulnerabilities_found || 
                                                report.summary.total_vulnerabilities || 0;
          report.summary.hosts_scanned = report.summary.hosts_scanned || 
                                        report.summary.total_hosts || 0;
          
          return report;
        });
        
        setReportList(processedReports);
      }
    } catch (error) {
      console.error('리포트 목록 가져오기 실패:', error);
      setError('리포트 목록을 불러오는 데 실패했습니다.');
    } finally {
      setIsLoadingReports(false);
    }
  };
  
  // 특정 스캔 결과 가져오기
  const handleFetchScan = async (scanId: string) => {
    try {
      // 비동기 액션 디스패치
      await dispatch(fetchScanById(scanId)).unwrap();
      // 스캔 결과 페이지로 리디렉션
      navigate(`/results/${scanId}`);
    } catch (error) {
      console.error(`스캔 ID ${scanId} 가져오기 실패:`, error);
    }
  };
  
  // 특정 리포트 가져오기
  const handleFetchReport = async (reportId: string) => {
    try {
      // 비동기 액션 디스패치
      await dispatch(fetchReportById(reportId)).unwrap();
      // 리포트 상세 페이지로 리디렉션
      navigate(`/reports/${reportId}`);
    } catch (error) {
      console.error(`리포트 ID ${reportId} 가져오기 실패:`, error);
    }
  };
  
  // 스캔 기록 삭제하기
  const deleteScan = async (scanId: string) => {
    if (!window.confirm('이 스캔 기록을 정말 삭제하시겠습니까?')) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      await axios.delete(`${API_URL}/scans/${scanId}`);
      
      // 삭제된 스캔 관련 데이터 정리
      dispatch(clearCurrentScan());  // 현재 스캔 데이터 초기화
      dispatch(clearVulnerabilityResults());  // 취약점 분석 결과 초기화
      
      // 세션 스토리지에서 관련 데이터 정리
      sessionStorage.removeItem('current_scan');
      sessionStorage.removeItem('current_vulnerability');
      
      // 캐시 정리를 위해 local storage 항목들도 확인
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(scanId)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // 삭제 성공 후 목록 갱신
      fetchScanList();
      
      console.log(`스캔 ID ${scanId} 및 관련 데이터 삭제 완료`);
    } catch (error) {
      console.error(`스캔 ID ${scanId} 삭제 실패:`, error);
      setError('스캔 기록 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // 리포트 삭제하기
  const deleteReport = async (reportId: string) => {
    if (!window.confirm('이 리포트를 정말 삭제하시겠습니까?')) {
      return;
    }
    
    setIsDeletingReport(true);
    setError(null);
    
    try {
      await axios.delete(`${API_URL}/reports/${reportId}`);
      
      // 현재 리포트가 삭제된 리포트와 동일한 경우 Redux 스토어 초기화
      if (currentReport && currentReport.report_id === reportId) {
        dispatch(clearCurrentReport());
        // 세션 스토리지에서도 삭제
        sessionStorage.removeItem('current_report');
      }
      
      // 삭제 성공 후 목록 갱신
      fetchReportList();
      
      console.log(`리포트 ID ${reportId} 삭제 완료`);
    } catch (error) {
      console.error(`리포트 ID ${reportId} 삭제 실패:`, error);
      setError('리포트 삭제에 실패했습니다.');
    } finally {
      setIsDeletingReport(false);
    }
  };
  
  useEffect(() => {
    fetchScanList();
    fetchReportList();
  }, []);
  
  const handleViewScan = (scanId: string) => {
    handleFetchScan(scanId);
  };
  
  const handleViewReport = (reportId: string) => {
    handleFetchReport(reportId);
  };
  
  const handleDeleteScan = (scanId: string) => {
    deleteScan(scanId);
  };
  
  const handleDeleteReport = (reportId: string) => {
    deleteReport(reportId);
  };
  
  // 타임스탬프를 날짜로 안전하게 변환
  const formatDate = (timestamp?: string) => {
    if (!timestamp) return '날짜 정보 없음';
    
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '유효하지 않은 날짜';
      return date.toLocaleString();
    } catch (err) {
      console.error('날짜 형식 변환 오류:', err);
      return '유효하지 않은 날짜';
    }
  };
  
  const getRiskLevelVariant = (riskLevel: string) => {
    switch(riskLevel?.toLowerCase()) {
      case '심각': return 'destructive';
      case '높음': return 'destructive';
      case '중간': return 'warning';
      case '낮음': return 'success';
      default: return 'secondary';
    }
  };
  
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>이전 스캔 및 리포트</CardTitle>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3">스캔 기록</h3>
          
          {isLoadingScans ? (
            <p className="text-muted-foreground">로딩 중...</p>
          ) : scanList && scanList.length === 0 ? (
            <p className="text-muted-foreground">스캔 기록이 없습니다.</p>
          ) : scanList && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>대상</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanList.map((scan: ScanMeta) => (
                    <TableRow key={scan.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(scan.timestamp)}</TableCell>
                      <TableCell>{scan.target || '타겟 정보 없음'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button 
                          variant="link"
                          onClick={() => handleViewScan(scan.id)}
                          disabled={isDeleting}
                        >
                          보기
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteScan(scan.id)}
                          disabled={isDeleting}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-3">리포트</h3>
          
          {isLoadingReports ? (
            <p className="text-muted-foreground">로딩 중...</p>
          ) : reportList && reportList.length === 0 ? (
            <p className="text-muted-foreground">리포트가 없습니다.</p>
          ) : reportList && (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>타겟 IP</TableHead>
                    <TableHead>위험 수준</TableHead>
                    <TableHead>취약점 수</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportList.map((report: ReportMeta) => (
                    <TableRow key={report.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(report.timestamp)}</TableCell>
                      <TableCell>
                        {report.summary && report.summary.target_ips && report.summary.target_ips.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {report.summary.target_ips.slice(0, 3).map((ip, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {ip}
                              </Badge>
                            ))}
                            {report.summary.target_ips.length > 3 && (
                              <span className="text-xs text-muted-foreground">+{report.summary.target_ips.length - 3} 더 있음</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">정보 없음</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {report.summary && report.summary.risk_level ? (
                          <Badge variant={getRiskLevelVariant(report.summary.risk_level) as any}>
                            {report.summary.risk_level}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">없음</Badge>
                        )}
                      </TableCell>
                      <TableCell>{report.summary?.vulnerabilities_found || report.summary?.total_vulnerabilities || 0}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="link"
                          onClick={() => handleViewReport(report.id)}
                          disabled={isDeletingReport}
                        >
                          보기
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={isDeletingReport}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScanHistory; 