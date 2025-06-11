import React, { useEffect, useState, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { RootState } from '../store';
import { useAppDispatch } from '../store/hooks';
import { setCurrentReport, clearCurrentReport, fetchReportById } from '../store/slices/reportSlice';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { HostInfo, PortInfo, ScriptInfo, Vulnerability } from '../types';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import apiService, { SearchsploitResult } from '../services/api';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

// API URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const ReportDetail: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { currentReport } = useSelector((state: RootState) => state.report);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchsploitResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // 컴포넌트 언마운트 시 Redux 상태 정리
  useEffect(() => {
    // 페이지를 떠날 때 `currentReport`를 비워서 메모리 누수를 방지
    return () => {
      dispatch(clearCurrentReport());
    };
  }, [dispatch]);
  
  // 리포트 데이터 가져오는 함수
  const fetchReportData = useCallback(async () => {
    if (!reportId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log(`리포트 데이터 불러오기 시작: ${reportId}`);
      
      // API에서 리포트 데이터 로드
      const response = await axios.get(`${API_URL}/reports/${reportId}`);
      console.log('API에서 리포트 데이터 로드 성공:', reportId);
      dispatch(setCurrentReport(response.data));
    } catch (error: any) {
      console.error(`리포트 ID ${reportId} 가져오기 실패:`, error);
      setError(error.response?.data?.error || '리포트를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
      setHasAttemptedLoad(true); // 로딩 시도 표시
    }
  }, [reportId, dispatch]);
  
  // 컴포넌트 마운트 시 초기화 및 데이터 로딩
  useEffect(() => {
    // reportId가 변경되면 상태 리셋
    if (reportId) {
      setHasAttemptedLoad(false);
      
      // 현재 리포트 ID가 변경되면 Redux 상태 초기화
      if (currentReport && currentReport.report_id !== reportId) {
        dispatch(clearCurrentReport());
      }
    }
  }, [reportId, currentReport?.report_id, dispatch]);
  
  // 데이터 로드 로직 (초기 로드 또는 reportId 변경 시)
  useEffect(() => {
    // 이미 데이터 로딩을 시도했거나 로딩 중이면 중복 API 호출 방지
    if (hasAttemptedLoad || isLoading) return;
    
    // reportId가 있고, currentReport가 없거나 id가 일치하지 않을 때만 API 호출
    if (reportId && (!currentReport || currentReport.report_id !== reportId)) {
      fetchReportData();
    } else {
      // 현재 리포트가 이미 있는 경우
      setHasAttemptedLoad(true);
    }
  }, [reportId, currentReport, hasAttemptedLoad, isLoading, fetchReportData]);
  
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
  
  // 서비스 타입에 따라 아이콘 반환
  const getServiceIcon = (service?: string) => {
    if (!service) return '🔌';
    
    switch (service.toLowerCase()) {
      case 'http': case 'https': return '🌐';
      case 'ssh': return '🔒';
      case 'ftp': return '📁';
      case 'smtp': case 'pop3': case 'imap': return '✉️';
      case 'dns': return '🔍';
      case 'mysql': case 'postgresql': case 'oracle': case 'mssql': return '🗄️';
      case 'telnet': return '📺';
      case 'rdp': return '🖥️';
      default: return '🔌';
    }
  };
  
  // 스크립트 ID에 따라 사용자 친화적 제목 반환
  const getScriptTitle = (id?: string) => {
    if (!id) return '정보';
    
    switch (id) {
      case 'http-title': return '페이지 제목';
      case 'http-robots.txt': return '로봇 배제 표준';
      case 'http-server-header': return '웹 서버 정보';
      case 'http-methods': return '지원 HTTP 메소드';
      case 'ssl-cert': return 'SSL 인증서';
      case 'ssh-hostkey': return 'SSH 호스트 키';
      case 'banner': return '서비스 배너';
      default: return id;
    }
  };
  
  // 스크립트 타입에 따라 배경색 지정
  const getScriptBackground = (id?: string) => {
    if (!id) return '';
    
    if (id.startsWith('http-')) return 'bg-blue-50/30';
    if (id.startsWith('ssl-')) return 'bg-green-50/30';
    if (id.startsWith('ssh-')) return 'bg-yellow-50/30';
    if (id.startsWith('ftp-')) return 'bg-purple-50/30';
    return '';
  };
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('검색어를 입력해주세요.');
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);
    
    try {
      const response = await apiService.searchsploit(searchQuery);
      if (response.data.RESULTS_EXPLOIT && response.data.RESULTS_EXPLOIT.length > 0) {
        setSearchResults(response.data.RESULTS_EXPLOIT);
      } else {
        setSearchResults([]);
      }
    } catch (error: any) {
      setSearchError(error.response?.data?.error || '검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleDownloadExploit = async (path: string) => {
    try {
      await apiService.downloadExploitFile(path);
    } catch (error: any) {
      console.error('Exploit 다운로드 실패:', error);
      setSearchError('Exploit 파일 다운로드 실패');
    }
  };
  
  if (isLoading) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>리포트</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded bg-secondary text-secondary-foreground">
            리포트 데이터를 불러오는 중입니다...
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (error || !currentReport) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>리포트</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded bg-destructive/10 text-destructive">
            {error || '사용 가능한 리포트가 없습니다.'}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // summary 안전하게 접근
  const summary = currentReport.summary || {};
  
  // 호환성을 위해 details 또는 vuln_results 필드 모두 확인
  // API 응답 구조에 따라 필드 위치가 다를 수 있음
  const details = currentReport.details || // 새로운 구조
                  currentReport.vuln_results || // 이전 구조
                  {}; // 기본값
  
  // 디버깅을 위한 콘솔 로그
  console.log('[ReportDetail] 현재 리포트 데이터:', {
    report_id: currentReport.report_id,
    has_details: !!currentReport.details,
    has_vuln_results: !!currentReport.vuln_results,
    final_details: details,
    hosts_count: Array.isArray(details.hosts) ? details.hosts.length : 0,
    host_first: Array.isArray(details.hosts) && details.hosts.length > 0 ? 
      { 
        host: details.hosts[0].host,
        ports_count: details.hosts[0].ports?.length || 0,
        has_vulnerabilities: details.hosts[0].ports?.some((p: any) => p.vulnerabilities?.length > 0)
      } : null
  });
                  
  // 호스트 정보 안전하게 접근
  const hosts = Array.isArray(details.hosts) ? details.hosts : [];
  
  // 실제로 취약점이 있는지 확인
  const hasVulnerabilities = hosts.some((host: HostInfo) => 
    Array.isArray(host.ports) && host.ports.some((port: PortInfo) => 
      Array.isArray(port.vulnerabilities) && port.vulnerabilities.length > 0
    )
  );
  
  return (
    <>
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>보안 취약점 리포트</CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">요약</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">스캔한 호스트</div>
                <div className="text-2xl font-bold">{summary.hosts_scanned || summary.total_hosts || hosts.length || 0}</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">발견된 취약점</div>
                <div className="text-2xl font-bold">{summary.vulnerabilities_found || summary.total_vulnerabilities || 0}</div>
              </div>
              <div className="p-4 border rounded">
                <div className="text-sm text-muted-foreground">위험 수준</div>
                <div className="text-2xl font-bold">
                  <Badge variant={getRiskLevelVariant(summary.risk_level || '없음') as any} className="text-base">
                    {summary.risk_level || '없음'}
                  </Badge>
                </div>
              </div>
            </div>
            
            {summary.target_ips && summary.target_ips.length > 0 && (
              <div className="mt-4 p-4 border rounded">
                <div className="text-sm text-muted-foreground mb-2">타겟 IP</div>
                <div className="flex flex-wrap gap-2">
                  {summary.target_ips.map((ip: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-sm">{ip}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground mt-4">
              리포트 생성: {formatDate(currentReport.timestamp || summary.scan_date)}
            </p>
          </div>
          
          {hosts.length > 0 ? (
            <div className="space-y-8">
              <h3 className="text-xl font-semibold mb-4 border-b pb-2">취약점 상세 분석</h3>
              
              {hosts.map((host: HostInfo, hostIndex: number) => (
                <Card key={hostIndex} className="bg-white shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Host: {host.host || '알 수 없는 호스트'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* OS 정보 표시 */}
                    {(host as any).os_details && (host as any).os_details.os_matches && (host as any).os_details.os_matches.length > 0 && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="text-md font-semibold mb-2 text-gray-700">운영 체제 정보</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {(host as any).os_details.os_matches.map((match: any, index: number) => (
                            <li key={index}>
                              <span className="font-medium">{match.name}</span> (정확도: {match.accuracy}%)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {host.ports && host.ports.length > 0 ? (
                      <div className="space-y-6">
                        {host.ports.map((port: PortInfo, portIndex: number) => (
                          <div key={portIndex} className="p-4 border rounded-lg bg-gray-50/50">
                            <h5 className="text-base font-semibold mb-3 flex items-center gap-2">
                              <span className="text-blue-600">{getServiceIcon(port.service)}</span>
                              <span>포트 {port.port || 'N/A'}/{port.protocol || 'tcp'}: {port.service || '알 수 없음'}</span>
                              <Badge variant={port.state === 'open' ? 'success' : 'secondary'}>{port.state || 'unknown'}</Badge>
                            </h5>
                            
                            {port.product && (
                              <div className="text-sm text-muted-foreground mb-4 pl-6">
                                <p><strong>Product:</strong> {port.product || 'N/A'}</p>
                                {port.version && <p><strong>Version:</strong> {port.version || 'N/A'}</p>}
                                {port.extrainfo && <p><strong>Extra Info:</strong> {port.extrainfo || 'N/A'}</p>}
                              </div>
                            )}

                            {/* 서비스 스크립트 정보 섹션 */}
                            {port.scripts && port.scripts.length > 0 && (
                              <div className="mb-4 pl-6">
                                <h6 className="text-sm font-semibold mb-2 text-gray-600">서비스 스크립트 정보</h6>
                                <div className="space-y-3">
                                  {port.scripts.map((script: ScriptInfo, scriptIndex: number) => (
                                    <div key={scriptIndex} className={`text-sm p-3 border rounded-md ${getScriptBackground(script.id)}`}>
                                      <div className="font-medium text-xs mb-1 text-gray-800">{getScriptTitle(script.id)}</div>
                                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground bg-white p-2 rounded max-h-[200px] overflow-y-auto">{script.output || ''}</pre>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 취약점 정보 섹션 */}
                            <div className="pl-6">
                              <h6 className="text-sm font-semibold mb-2 text-gray-600">취약점 분석</h6>
                              {port.vulnerabilities && port.vulnerabilities.length > 0 ? (
                                <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100 pr-1 border rounded-md">
                                  <Accordion type="single" collapsible className="w-full">
                                    {port.vulnerabilities.map((vuln: Vulnerability, vulnIndex: number) => (
                                      <AccordionItem key={vulnIndex} value={`vuln-${portIndex}-${vulnIndex}`} className="border-b last:border-b-0 overflow-hidden">
                                        <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/30">
                                          <div className="flex items-center justify-between w-full">
                                            <div className="font-medium text-sm whitespace-nowrap mr-2">{vuln.cve_id || vuln.id || 'N/A'}</div>
                                            {(vuln.cve_id || vuln.id) && (
                                              <div className="text-xs text-blue-500 underline px-2 flex-1">
                                                <a href={`https://vulners.com/cve/${vuln.cve_id || vuln.id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                                  https://vulners.com/cve/{vuln.cve_id || vuln.id}
                                                </a>
                                              </div>
                                            )}
                                            <Badge 
                                              variant={getRiskLevelVariant(
                                                vuln.cvss_score >= 9.0 ? '심각' :
                                                vuln.cvss_score >= 7.0 ? '높음' :
                                                vuln.cvss_score >= 4.0 ? '중간' : '낮음'
                                              ) as any}
                                            >
                                              {typeof vuln.cvss_score === 'number' ? vuln.cvss_score.toFixed(1) : (vuln.cvss_score || 'N/A')}
                                            </Badge>
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-3 py-2 bg-muted/10">
                                          <div className="text-xs text-muted-foreground max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                                            {typeof vuln.description === 'string' ? vuln.description : (typeof vuln.title === 'string' ? vuln.title : '설명 없음')}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    ))}
                                  </Accordion>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">이 포트에서 식별된 취약점이 없습니다.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground p-4 text-center">이 호스트에서 분석할 포트 정보가 없습니다.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-4 border rounded bg-secondary text-secondary-foreground">
              스캔된 호스트 정보를 사용할 수 없습니다.
            </div>
          )}

          {/* Searchsploit Section */}
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-lg font-semibold mb-4">Exploit 검색 (Searchsploit)</h3>
            <div className="flex items-center gap-2 mb-4">
              <Input
                type="text"
                placeholder="예: Apache 2.4.29, Windows 10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isSearching}
                className="max-w-xs"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? '검색 중...' : '검색'}
              </Button>
            </div>

            {searchError && <p className="text-red-500 text-sm mb-4">{searchError}</p>}

            {isSearching ? (
              <p className="text-sm text-muted-foreground">결과를 검색하고 있습니다...</p>
            ) : (
              (searchResults.length > 0) ? (
                <div className="mb-6 mt-4 overflow-x-auto max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Path</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((result) => (
                        <TableRow key={result.ID}>
                          <TableCell className="font-medium">{result.Title}</TableCell>
                          <TableCell>
                            <span 
                              className="text-blue-500 hover:text-blue-700 underline cursor-pointer" 
                              onClick={() => handleDownloadExploit(result.Path)}
                            >
                              {result.Path}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  검색어를 입력하고 검색 버튼을 클릭하세요.
                </p>
              )
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* 메모리 사용량을 줄이기 위해 showAddReportButton을 false로 설정 */}
      {currentReport && !isLoading && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>네트워크 토폴로지</CardTitle>
              <CardDescription>토폴로지 탭을 선택하여 네트워크 구조를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              토폴로지에 이 리포트를 추가하려면 <Button variant="link" onClick={() => navigate(`/?add_report=${currentReport.report_id}`)}>토폴로지 페이지로 이동하여 추가</Button>하세요.
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default ReportDetail; 