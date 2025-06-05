import React, { useState } from 'react';
import axios from 'axios';

interface ApiResult {
  success: boolean;
  data?: any;
  error?: string;
}

const TestPage: React.FC = () => {
  // 일반 API 테스트 상태
  const [apiUrl, setApiUrl] = useState<string>('');
  const [method, setMethod] = useState<string>('GET');
  
  // 공통 상태
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 일반 API 호출 핸들러
  const handleGeneralApiCall = async () => {
    if (!apiUrl) {
      setError('API URL을 입력해주세요');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response;
      
      if (method === 'GET') {
        response = await axios.get(apiUrl);
      } else if (method === 'POST') {
        response = await axios.post(apiUrl);
      } else {
        throw new Error('지원하지 않는 HTTP 메서드입니다');
      }

      setResult({
        success: true,
        data: response.data
      });
    } catch (err: any) {
      setError(err.message || '알 수 없는 오류가 발생했습니다');
      setResult({
        success: false,
        error: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '800px', 
      margin: '0 auto' 
    }}>
      <h1>API 테스트</h1>
      
      <div style={{ 
        border: '1px solid #ddd', 
        borderRadius: '8px', 
        padding: '20px',
        backgroundColor: '#f9f9f9' 
      }}>
        <div style={{ marginBottom: '20px' }}>
          <div>
            <label htmlFor="api-url">API URL:</label>
            <input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://example.com/api"
              style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
            />
          </div>
          <div>
            <label htmlFor="method">HTTP 메서드:</label>
            <select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ padding: '8px', marginBottom: '10px' }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
          <button
            style={{
              padding: '10px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              opacity: loading ? 0.7 : 1
            }}
            onClick={handleGeneralApiCall}
            disabled={loading}
          >
            {loading ? '요청 중...' : 'API 요청 보내기'}
          </button>
        </div>
      </div>
      
      {/* 결과 표시 */}
      {(result || error) && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: result?.success ? '#f0fff4' : '#fff5f5' 
        }}>
          <h3>{result?.success ? '성공' : '오류'}</h3>
          
          {error && (
            <div style={{ color: '#e53e3e', marginBottom: '10px' }}>
              {error}
            </div>
          )}
          
          {result && (
            <div>
              <h4>응답:</h4>
              <pre
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '10px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '400px'
                }}
              >
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestPage; 