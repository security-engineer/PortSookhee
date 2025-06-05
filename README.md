# PortSookhee

네트워크 취약점 분석 시스템

## 프로젝트 개요

PortSookhee는 네트워크 취약점 분석을 위한 웹 기반 시스템입니다. 네트워크 토폴로지를 시각화하고, nmap 기반 스캔을 통해 대상 시스템의 포트, 서비스, OS 정보 및 잠재적 취약점을 탐지합니다.

## 주요 기능

- 네트워크 토폴로지 시각화
- Nmap 기반 네트워크 스캔
  - 빠른 스캔: 일반적인 포트만 빠르게 스캔 (서비스 버전 감지 및 스크립트 실행 포함)
  - 전체 스캔: 모든 포트와 OS 정보를 상세하게 스캔
  - 사용자 정의 스캔: 사용자가 지정한 포트와 옵션으로 스캔
- 스캔 결과 시각화 및 분석
- TryHackMe 연동 (OpenVPN 설정)

## 최근 업데이트: 스캔 기능 개선

### 스캔 기능 문제 해결
- 인증 관련 오류 수정: 스캔 요청 시 발생하던 "요청 설정 오류: 권한 없음" 문제 해결
- 백엔드 인증 시스템 수정:
  - 개발 모드 강제 활성화로 인증 단순화
  - 모든 스캔 엔드포인트 인증 없이 접근 가능
  - `X-Skip-Auth`, `X-Admin-Access` 특수 헤더를 통한 인증 우회 기능 추가
  - `/api/health` 엔드포인트 추가로 API 서버 상태 확인 가능
- CORS 문제 해결:
  - 모든 라우트에 OPTIONS 메서드 추가로 CORS preflight 요청 지원
  - 모든 응답에 CORS 헤더 명시적 추가
  - 개발 환경에서 모든 오리진 허용

### 안정성 개선
- 디버그 모드 활성화로 오류 상세 정보 제공
- 백엔드 연결 실패 시 자동 재시도 로직 추가
- 인증 관련 오류 시 더 명확한 에러 메시지 제공

## 프로젝트 구조

```
PortSookhee/
├── backend/                 # Python/Flask 백엔드
│   ├── app/                 # 백엔드 애플리케이션 코드
│   │   ├── routes/          # API 라우트 핸들러
│   │   │   ├── auth.py      # 인증 관련 API
│   │   │   ├── main.py      # 기본 API 경로
│   │   │   ├── scan_routes.py   # 스캔 관련 API
│   │   │   └── openvpn_routes.py # OpenVPN 관련 API
│   │   ├── scan.py          # 네트워크 스캔 구현
│   │   ├── config.py        # 애플리케이션 설정
│   │   └── __init__.py      # 애플리케이션 초기화
│   ├── run.py               # 백엔드 실행 스크립트
│   └── requirements.txt     # 필요한 Python 패키지
│
└── web-front/               # React 프론트엔드
    └── my-app/              # React 애플리케이션
        ├── src/             # 소스 코드
        │   ├── components/  # 리액트 컴포넌트
        │   │   ├── auth/    # 인증 관련 컴포넌트
        │   │   ├── scan/    # 스캔 관련 컴포넌트
        │   │   ├── topology/ # 토폴로지 시각화 컴포넌트
        │   │   └── vpn/     # VPN 관련 컴포넌트
        │   ├── pages/       # 페이지 컴포넌트
        │   ├── layouts/     # 레이아웃 컴포넌트
        │   ├── store/       # Redux 상태 관리
        │   └── hooks/       # 사용자 정의 훅
        └── public/          # 정적 파일
```

## 주요 컴포넌트 설명

### 백엔드 (Python/Flask)

#### 핵심 모듈

1. **app/__init__.py**: 애플리케이션 초기화, 데이터베이스 연결, CORS 설정, 라우트 등록 담당
   - MongoDB 연결 및 관리 로직 포함
   - 메모리 기반 데이터 저장 대체 기능 제공
   - 인증 시스템 및 CORS 설정 관리

2. **app/scan.py**: 네트워크 스캔 기능 구현
   - Nmap 라이브러리 사용하여 스캔 기능 제공
   - 스캔 모드: 빠른 스캔, 전체 스캔, 사용자 정의 스캔
   - 스캔 결과 처리 및 포맷팅

3. **app/routes/scan_routes.py**: 스캔 관련 API 라우트
   - `/scan/`: 스캔 작업 시작
   - `/scan/<scan_id>`: 스캔 상태 조회
   - `/scan/quick`, `/scan/full`, `/scan/custom`: 특정 스캔 모드 실행
   - `/scan/history`: 스캔 기록 조회
   - CORS 지원을 위한 OPTIONS 메서드 처리

4. **app/routes/openvpn_routes.py**: OpenVPN 관련 기능 제공
   - TryHackMe VPN 설정 및 연결 기능

5. **app/routes/auth.py**: 사용자 인증 기능 제공
   - 로그인, 회원가입, 권한 검증

### 프론트엔드 (React/TypeScript)

#### 핵심 컴포넌트

1. **components/topology/Topology.tsx**: 네트워크 토폴로지 시각화
   - Cytoscape.js 라이브러리 사용
   - 노드(호스트, 라우터, 스위치)와 연결 표시
   - 드래그, 줌, 패닝 기능 지원

2. **components/scan/ScanResults.tsx**: 스캔 결과 표시
   - 발견된 포트, 서비스, OS 정보 표시
   - 취약점 감지 및 표시

3. **components/scan/ScanReport.tsx**: 스캔 결과 종합 리포트 표시
   - 스캔 메타데이터 및 요약 정보 제공
   - 호스트 및 포트 정보 시각적 표현

4. **components/vpn/VPNManager.tsx**: OpenVPN 설정 및 관리
   - TryHackMe VPN 설정 파일 업로드 및 연결
   - VPN 상태 모니터링

## API 통신 구조

### 백엔드 API 엔드포인트

1. **스캔 관련 API**:
   - `POST /api/scan/`: 일반 스캔 작업 시작
   - `POST /api/scan/quick`: 빠른 스캔 실행
   - `POST /api/scan/full`: 전체 스캔 실행 
   - `POST /api/scan/custom`: 사용자 정의 스캔 실행
   - `GET /api/scan/<scan_id>`: 특정 스캔의 상태 조회
   - `GET /api/scan/history`: 스캔 기록 조회
   - `POST /api/scan/test`: 테스트 스캔 실행 (Nmap 없이도 작동)

2. **인증 관련 API**:
   - `POST /api/auth/login`: 사용자 로그인
   - `POST /api/auth/register`: 사용자 등록
   - `POST /api/auth/anonymous`: 익명 로그인

3. **OpenVPN 관련 API**:
   - `POST /api/openvpn/upload`: OpenVPN 설정 파일 업로드
   - `POST /api/openvpn/connect`: VPN 연결
   - `GET /api/openvpn/status`: VPN 연결 상태 확인
   - `POST /api/openvpn/disconnect`: VPN 연결 종료

4. **시스템 상태 API**:
   - `GET /api/health`: API 서버 상태 확인
   - `GET /api/`: 기본 상태 확인

### 프론트엔드-백엔드 통신

1. **Axios 인스턴스**:
   - 기본 URL과 타임아웃 설정
   - 요청/응답 인터셉터로 오류 핸들링
   - 재시도 로직 구현 (`callApiWithRetry()`)

2. **데이터 흐름**:
   1. 사용자 입력 → React 컴포넌트 상태 → Axios API 요청
   2. Flask 백엔드 API 처리 → 응답 반환
   3. 응답 데이터 → React 컴포넌트 상태 업데이트 → UI 렌더링

3. **에러 처리**:
   - 서버 연결 오류 감지 및 상태 확인
   - API 응답 오류 분류 및 사용자 피드백 제공
   - 네트워크 문제 발생 시 자동 재시도

4. **데이터 저장**:
   - MongoDB 기반 데이터 저장 (가용 시)
   - 메모리 기반 임시 데이터 저장 (MongoDB 실패 시)
   - LocalStorage 활용 (토폴로지 노드 정보 등)

## 데이터 흐름 및 상태 관리

1. **스캔 프로세스**:
   - 사용자 → 스캔 설정 입력 → API 호출
   - API 호출 → 스캔 작업 생성 → nmap 실행
   - 비동기 폴링: 프론트엔드 → /api/scan/{id} → 스캔 상태 및 결과
   - 완료 시: 결과 → 결과 컴포넌트 표시

2. **토폴로지 관리**:
   - 스캔 결과 → 토폴로지 노드로 변환 (addHostToTopology)
   - 노드 데이터 → LocalStorage 저장
   - LocalStorage → 토폴로지 컴포넌트에서 로드 → Cytoscape 렌더링

3. **인증 흐름**:
   - 사용자 로그인 → Redux 저장소에 토큰 및 사용자 정보 저장
   - API 요청에 인증 토큰 포함
   - 엑세스 제어: 인증 필요 경로는 auth.py에서 JWT 검증
   - 개발 모드에서는 인증 우회 기능 활성화

## 설치 및 실행 방법

### 백엔드 설치

```bash
# 레포지토리 클론
git clone https://github.com/yourusername/PortSookhee.git
cd PortSookhee

# 가상환경 생성 및 활성화
python -m venv backend/venv
source backend/venv/bin/activate  # Windows: backend\venv\Scripts\activate

# 필수 패키지 설치
pip install -r backend/requirements.txt

# Nmap 설치 (시스템 패키지 관리자 사용)
# Ubuntu/Debian: sudo apt-get install nmap
# CentOS/RHEL: sudo yum install nmap
# macOS: brew install nmap
# Windows: https://nmap.org/download.html에서 설치 파일 다운로드

# OpenVPN 설치 (TryHackMe 연동 시 필요)
# Ubuntu/Debian: sudo apt-get install openvpn
# CentOS/RHEL: sudo yum install openvpn
# macOS: brew install openvpn
# Windows: https://openvpn.net/community-downloads/에서 설치 파일 다운로드
```

### 프론트엔드 설치

```bash
# 필수 패키지 설치
cd web-front/my-app
npm install
```

### 환경 변수 설정

```bash
# 백엔드 환경 변수
export MONGODB_URL="mongodb://your-mongodb-server:27017/PortSookhee"
export JWT_SECRET="your-jwt-secret"
export OPENVPN_CONFIG_DIR="/path/to/vpn/configs"
# 개발 모드 활성화
export FLASK_ENV="development"

# 프론트엔드 환경 변수
cd web-front/my-app
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env.local
```

### 실행

#### Windows에서 실행
```powershell
# 백엔드 실행
cd backend
python run.py

# 새 PowerShell 창에서 프론트엔드 실행
cd web-front/my-app
npm start
```

#### Linux/macOS에서 실행
```bash
# 백엔드 실행
cd backend
python run.py

# 새 터미널에서 프론트엔드 실행
cd web-front/my-app
npm start
```

## 기술 스택

- **백엔드**:
  - Python 3.x
  - Flask (웹 프레임워크)
  - pymongo (MongoDB 드라이버)
  - python-nmap (Nmap 래퍼)
  - JWT (인증)
  
- **프론트엔드**:
  - React 18
  - TypeScript
  - Redux (상태 관리)
  - Axios (HTTP 클라이언트)
  - Cytoscape.js (네트워크 시각화)

- **도구 및 라이브러리**:
  - Nmap (네트워크 스캔)
  - OpenVPN (VPN 연결)
  - MongoDB (데이터베이스)

## 확장 및 개선 사항

- 실시간 네트워크 모니터링 기능
- 포트 스캔 외 추가 취약점 진단 기능
- 취약점 데이터베이스와 매칭하여 CVE 정보 제공
- 보고서 생성 및 내보내기 기능
- 인증 시스템 강화 및 역할 기반 접근 제어