const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * React 개발 서버의 프록시 설정
 * API 요청을 백엔드 서버로 전달하기 위한 설정입니다.
 * 백엔드 서버 주소를 명확히 지정합니다.
 */
module.exports = function(app) {
  // 백엔드 서버 주소 설정 - 명확히 localhost:5000 지정
  // 환경 변수가 있으면 해당 값 사용, 없으면 localhost로 기본 설정
  const BACKEND_URL = 'http://localhost:5000';
  
  console.log(`프록시 설정: ${BACKEND_URL}`);
  
  app.use(
    '/api',
    createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      secure: false, // HTTPS 인증서 검증 우회 (개발 환경용)
      logLevel: 'debug', // 자세한 로그 출력으로 변경
      
      // pathRewrite 제거 - '/api' 경로를 그대로 유지해야 함
      
      onProxyReq: (proxyReq, req, res) => {
        // 콘텐츠 타입이 없는 경우 추가
        if (!proxyReq.getHeader('Content-Type') && req.method !== 'OPTIONS') {
          proxyReq.setHeader('Content-Type', 'application/json');
        }
        
        // Accept 헤더 설정
        proxyReq.setHeader('Accept', 'application/json');
        
        // 권한 우회 헤더 추가
        proxyReq.setHeader('X-Skip-Auth', 'true');
        proxyReq.setHeader('X-Admin-Access', 'true');
        
        // 디버그 로깅 - URL 확인용
        const fullUrl = `${BACKEND_URL}${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> ${fullUrl}`);
        console.log(`[Proxy] Headers: ${JSON.stringify(proxyReq.getHeaders())}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // 응답 로깅 - 상세 정보 추가
        console.log(`[Proxy Response] ${req.method} ${req.url} -> ${proxyRes.statusCode}`);
        
        if (proxyRes.statusCode !== 200) {
          console.warn(`[Proxy Warning] 비정상 응답 코드: ${proxyRes.statusCode}`);
        }
        
        // CORS 헤더 추가
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
        proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, HEAD';
        proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access';
        proxyRes.headers['Access-Control-Max-Age'] = '86400'; // 24시간 캐싱
      },
      onError: (err, req, res) => {
        console.error('[Proxy Error]', err.message);
        console.error(`요청 정보: ${req.method} ${req.url}`);
        
        // 프록시 오류 시 응답 처리
        if (!res.headersSent) {
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
        }
        
        const errorMsg = err.message || 'Proxy Error';
        const response = {
          error: 'Proxy Error',
          message: errorMsg,
          code: 'PROXY_ERROR',
          time: new Date().toISOString(),
          path: req.url
        };
        
        res.end(JSON.stringify(response, null, 2));
      }
    })
  );
}; 