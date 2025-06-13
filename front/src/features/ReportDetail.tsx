import React, { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import { Report } from '../types';
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
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  
  // Redux 대신 컴포넌트 로컬 상태 사용
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchsploitResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  // 리포트 데이터 가져오는 함수
  const fetchReportData = useCallback(async () => {
    if (!reportId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      console.log(`리포트 데이터 불러오기 시작: ${reportId}`);
      
      const response = await axios.get(`${API_URL}/reports/${reportId}`);
      console.log('API에서 리포트 데이터 로드 성공:', reportId);
      
      // 로컬 상태에 데이터 저장
      setCurrentReport(response.data);
      
    } catch (error: any) {
      console.error(`리포트 ID ${reportId} 가져오기 실패:`, error);
      setError(error.response?.data?.error || '리포트를 불러오는 데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);
  
  // 컴포넌트 마운트 시 데이터 로딩
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);
  
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
          <div className="space-y-6">
            {/* 요약 정보 */}
            <div>
              <h3 className="text-lg font-semibold mb-3">요약 정보</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded">
                  <div className="text-sm text-muted-foreground">스캔한 호스트</div>
                  <div className="text-2xl font-bold">{summary.hosts_scanned || 0}</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-sm text-muted-foreground">발견된 취약점</div>
                  <div className="text-2xl font-bold">{summary.vulnerabilities_found || 0}</div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-sm text-muted-foreground">위험 수준</div>
                  <div className="text-2xl font-bold">
                    <Badge variant={getRiskLevelVariant(summary.risk_level)}>{summary.risk_level || '정보 없음'}</Badge>
                  </div>
                </div>
                <div className="p-4 border rounded">
                  <div className="text-sm text-muted-foreground">대상</div>
                  <div className="text-lg font-semibold truncate">{currentReport.details.target}</div>
                </div>
              </div>
              
              <p className="text-sm text-muted-foreground mt-4">
                리포트 생성: {formatDate(currentReport.timestamp)}
              </p>
            </div>
            
            {/* 호스트별 상세 정보 */}
            <Tabs defaultValue="vulnerabilities">
              <TabsList>
                <TabsTrigger value="vulnerabilities">취약점 보기</TabsTrigger>
                <TabsTrigger value="searchsploit">Exploit-DB 검색</TabsTrigger>
              </TabsList>
              
              <TabsContent value="vulnerabilities">
                <div>
                  <h3 className="text-lg font-semibold my-4">호스트별 상세 정보</h3>
                  {hosts.length > 0 ? (
                    <Accordion type="multiple" className="w-full">
                      {hosts.map((host: HostInfo, index: number) => (
                        <AccordionItem key={index} value={`host-${index}`}>
                          <AccordionTrigger>
                            <div className="flex items-center justify-between w-full pr-4">
                              <span className="font-medium">{host.host}</span>
                              <Badge variant={host.state === 'up' ? 'success' : 'secondary'}>{host.state}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {host.ports && host.ports.length > 0 ? (
                              <div className="space-y-4 pt-2">
                                {host.ports.map((port: PortInfo, portIndex: number) => (
                                  <div key={portIndex} className="p-3 border rounded bg-muted/20">
                                    <div className="border-b pb-3 mb-3">
                                      <h5 className="text-base font-semibold mb-3 flex items-center gap-2">
                                        <span className="text-blue-600">{getServiceIcon(port.service)}</span>
                                        <span>포트 {port.port_id || 'N/A'}/{port.protocol || 'tcp'}: {port.service || '알 수 없음'}</span>
                                        <Badge variant={port.state === 'open' ? 'success' : 'secondary'}>{port.state || 'unknown'}</Badge>
                                      </h5>
                                      
                                      {(port.service || port.version) && (
                                        <div className="text-sm text-muted-foreground mb-4 pl-6">
                                          {port.service && <p><strong>Product:</strong> {port.service}</p>}
                                          {port.version && <p><strong>Version:</strong> {port.version}</p>}
                                        </div>
                                      )}
                                    </div>

                                    {/* 스크립트 정보 */}
                                    {port.scripts && port.scripts.length > 0 && (
                                      <div className="mb-4">
                                        <h6 className="text-sm font-semibold mb-2">서비스 스크립트 정보</h6>
                                        {port.scripts.map((script: ScriptInfo, scriptIndex: number) => (
                                          <div key={scriptIndex} className={`text-sm p-2 rounded border mb-2 ${getScriptBackground(script.id)}`}>
                                            <div className="font-medium text-xs mb-1">{getScriptTitle(script.id)}</div>
                                            <pre className="whitespace-pre-wrap text-muted-foreground text-xs max-h-48 overflow-y-auto font-sans">
                                              {script.output}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* 취약점 정보 */}
                                    {port.vulnerabilities && port.vulnerabilities.length > 0 && (
                                      <div>
                                        <h6 className="text-sm font-semibold mb-2">발견된 취약점</h6>
                                        <Table>
                                          <TableHeader className="sticky top-0 bg-white z-10">
                                            <TableRow>
                                              <TableHead>CVE ID</TableHead>
                                              <TableHead>취약점 정보 URL</TableHead>
                                              <TableHead>위험 수준</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {port.vulnerabilities.map((vuln: Vulnerability, vulnIndex: number) => {
                                              const vulnId = vuln.cve_id || vuln.id || 'N/A';
                                              const vulnType = vuln.type || 'exploit-db'; // 기본 타입 설정
                                              const vulnUrl = vulnId !== 'N/A' ? `https://vulners.com/${vulnType}/${vulnId}` : '#';

                                              return (
                                                <TableRow key={vulnIndex}>
                                                  <TableCell>{vulnId}</TableCell>
                                                  <TableCell>
                                                    {vulnId !== 'N/A' ? (
                                                      <a
                                                        href={vulnUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:underline"
                                                      >
                                                        {vulnUrl}
                                                      </a>
                                                    ) : (
                                                      <span>정보 없음</span>
                                                    )}
                                                  </TableCell>
                                                  <TableCell>
                                                    <Badge variant={getRiskLevelVariant(
                                                      vuln.cvss_score >= 9.0 ? '심각' :
                                                      vuln.cvss_score >= 7.0 ? '높음' :
                                                      vuln.cvss_score >= 4.0 ? '중간' : '낮음'
                                                    )}>
                                                      {typeof vuln.cvss_score === 'number' ? vuln.cvss_score.toFixed(1) : (vuln.cvss_score || 'N/A')}
                                                    </Badge>
                                                  </TableCell>
                                                </TableRow>
                                              );
                                            })}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground p-4 text-center">이 호스트에서 분석할 포트 정보가 없습니다.</p>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  ) : (
                    <div className="p-4 border rounded bg-secondary text-secondary-foreground">
                      스캔된 호스트 정보를 사용할 수 없습니다.
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="searchsploit">
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
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
      
      {/* 메모리 사용량을 줄이기 위해 showAddReportButton을 false로 설정 */}
      {/* {currentReport && !isLoading && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>네트워크 토폴로지</CardTitle>
              <CardDescription>토폴로지 탭을 선택하여 네트워크 구조를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {currentReport && currentReport.report_id ? (
                <p>
                  토폴로지에 이 리포트를 추가하려면 <Button variant="link" onClick={() => navigate(`/?add_report=${currentReport.report_id}`)}>토폴로지 페이지로 이동하여 추가</Button>하세요.
                </p>
              ) : (
                <p className="text-yellow-600">
                  이 리포트는 ID가 없어 토폴로지에 추가할 수 없습니다. 관리자에게 문의하세요.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )} */}
    </>
  );
};

export default ReportDetail; 