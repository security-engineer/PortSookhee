# PS2 - 네트워크 스캐너 프로젝트

이 프로젝트는 네트워크 스캐닝, 취약점 분석 및 보고서 생성 기능을 제공하는 웹 애플리케이션입니다.

## 주요 기능

1. Nmap을 활용한 네트워크 스캐닝
2. Vulners, Vulscan 스크립트를 통한 취약점 분석
3. 스캔 결과 및 취약점 분석 보고서 생성
4. 스캔 기록 관리
5. VPN 연결 관리

## 최근 수정 사항

### 2025-06-09: Redux 구조 개선 및 스캔 결과 표시 문제 해결

1. **문제점**:
   - 스캔 기록에서 "보기" 버튼을 클릭하면 결과가 로드되지만 화면에 표시되지 않았습니다.
   - API 응답은 성공적(상태 200)으로 데이터를 반환했으나, Redux 상태의 `currentScan`은 여전히 `null`이었습니다.
   - 로그 분석 결과, 스캔 데이터에 `scan_id` 필드가 누락되어 있거나 상태 업데이트가 제대로 이루어지지 않는 것을 확인했습니다.

2. **발견된 구조적 문제**:
   - `/store/scanSlice.ts`와 `/store/slices/scanSlice.ts` 두 개의 파일이 중복되어 Redux 상태 관리에 혼란을 야기했습니다.
   - Redux 스토어는 `slices/scanSlice.ts`를 사용하지만, 컴포넌트들은 `scanSlice.ts`의 액션을 가져와 사용하고 있었습니다.
   - 두 파일의 리듀서와 액션이 서로 다른 구현을 갖고 있어 상태 업데이트가 제대로 이루어지지 않았습니다.
   - NetworkTopology 컴포넌트에서 `currentResults` 대신 `currentVulnerability`를 참조해야 하는 불일치도 있었습니다.

3. **해결 방법**:
   - Redux 구조를 정리하여 `store/slices/scanSlice.ts`만 사용하도록 수정했습니다.
   - `scanSlice.ts`의 중요 기능(fetchScanById 등)을 `slices/scanSlice.ts`로 통합했습니다.
   - 누락된 액션(`setCurrentScan`)을 추가하여 컴포넌트 호환성을 유지했습니다.
   - 관련 컴포넌트의 import 경로를 정확한 위치로 수정했습니다.
   - `store.ts`에서 리듀서 import 경로를 올바르게 지정했습니다.
   - `NetworkTopology.tsx`에서 `currentResults` 대신 `currentVulnerability`를 사용하도록 수정했습니다.
   - 타입 안전성을 위해 명시적인 타입 주석 추가 (HostInfo, PortInfo, ScanResult 등)

4. **주요 수정 파일**:
   - `frontend/src/store/slices/scanSlice.ts`: Redux 액션 및 리듀서 통합
   - `frontend/src/features/ScanResults.tsx`: import 경로 수정 및 스캔 결과 로드 로직 개선
   - `frontend/src/features/ScanHistory.tsx`: import 경로 수정
   - `frontend/src/store/store.ts`: 올바른 리듀서 경로 지정
   - `frontend/src/features/NetworkTopology.tsx`: 변수명 수정 및 타입 주석 추가

5. **개선 효과**:
   - 스캔 결과 페이지가 정상적으로 데이터를 표시하게 됨
   - Redux 상태 관리 구조 일관성 확보
   - `scan_id` 필드가 없는 경우에도 자동으로 추가되어 데이터 일관성 유지
   - 디버깅 로그 추가로 상태 변화 추적 용이
   - TypeScript 타입 오류 해결로 코드 안정성 향상

### 2025-06-09: 스캔 결과 표시 문제 수정

ScanResults 컴포넌트에서 스캔 결과가 표시되지 않는 문제를 수정했습니다.

1. **문제점**:
   - 스캔 ID로 결과 페이지에 접근했을 때 데이터가 로드되지만 화면에 표시되지 않았습니다.
   - API에서 데이터는 정상적으로 반환되었으나 프론트엔드에서 표시되지 않았습니다.

2. **해결 방법**:
   - `scanSlice.ts`와 `ScanResults.tsx` 간의 상태 변수명 불일치를 수정했습니다. 
     - `scanSlice.ts`에서는 `isLoading`으로 정의되었지만, `ScanResults.tsx`에서는 `loading`으로 참조하고 있었습니다.
     - 모든 코드에서 `isLoading`을 `loading`으로 일관되게 변경했습니다.
   - 디버깅 로그를 추가하여 데이터 흐름을 명확히 추적할 수 있도록 했습니다.
     - `scanSlice.ts`의 `fetchScanById` 액션
     - `api.ts`의 `getScanById` 함수
     - `ScanResults.tsx`의 렌더링 로직

3. **추가 개선 사항**:
   - 스캔 데이터 로드 과정의 상세 로깅으로 디버깅 향상
   - 오류 처리 개선 및 사용자 피드백 명확화

이 수정으로 스캔 ID를 통해 스캔 결과 페이지에 접근하면 정상적으로 결과가 표시됩니다.

### 2025-06-09: UI 개선 - 취약점 목록 및 스크립트 출력 표시 방식 개선

1. **문제점**:
   - Vulners 스크립트 출력이 매우 길어 페이지를 크게 차지하는 문제가 있었습니다.
   - 발견된 취약점 목록이 테이블 형태로 표시되어 한 번에 모든 정보가 표시되는 문제가 있었습니다.
   - CVE 목록이 너무 많을 경우 페이지가 과도하게 길어지는 문제가 있었습니다.
   - 취약점 목록에 CVE ID와 CVSS 점수만 표시되어 있어 추가 정보가 부족했습니다.
   - Searchsploit 결과에서 파일 경로를 클릭하여 실제 파일을 다운로드할 수 없었습니다.

2. **개선 사항**:
   - ReportDetail 페이지와 VulnerabilityResults 페이지에서 스크립트 출력에 최대 높이와 스크롤바를 추가하여 공간 효율성을 높였습니다.
   - 취약점 목록을 테이블 형식에서 아코디언(드롭다운) 형식으로 변경하여 사용자가 필요한 정보만 펼쳐볼 수 있도록 개선했습니다.
   - searchsploit 검색 결과 테이블에도 최대 높이와 스크롤바를 추가하여 많은 결과가 있어도 페이지 레이아웃이 깨지지 않도록 했습니다.
   - ScanHistory 페이지의 스캔 기록 및 보고서 목록 테이블에 최대 높이와 스크롤바를 추가했습니다.
   - 테이블 헤더를 스크롤해도 상단에 고정되도록 `sticky` 속성을 적용했습니다.
   - 취약점 설명 텍스트에도 최대 높이와 스크롤바를 추가하여 긴 설명도 효율적으로 볼 수 있게 했습니다.
   - 스크롤바를 시각적으로 더 잘 보이도록 `scrollbar-thin`, `scrollbar-thumb-gray-400`, `scrollbar-track-gray-100` 클래스를 적용하여 스크롤바 스타일을 개선했습니다.
   - CVE 목록 전체를 하나의 스크롤 영역으로 감싸 목록이 많아도 페이지가 과도하게 길어지지 않도록 수정했습니다. 이를 통해 많은 수의 취약점이 있어도 고정된 높이 내에서 스크롤하여 확인할 수 있습니다.
   - 각 CVE ID 옆에 Vulners URL을 클릭 가능한 링크로 추가하여 사용자가 해당 취약점에 대한 자세한 정보를 쉽게 확인할 수 있도록 했습니다.
   - **Searchsploit 결과의 파일 경로를 클릭 가능한 링크로 변경하여 사용자가 직접 exploit 파일을 다운로드할 수 있도록 기능을 추가했습니다.**

3. **이점**:
   - 페이지 공간을 효율적으로 사용하여 사용자 경험 향상
   - 필요한 정보만 펼쳐볼 수 있어 정보 탐색이 용이해짐
   - 긴 스크립트 출력 내용이나 많은 취약점 정보가 있어도 UI가 깔끔하게 유지됨
   - 스캔 기록이나 보고서 목록이 많아도 페이지 길이가 과도하게 길어지지 않음
   - 테이블 헤더가 항상 보이므로 많은 데이터를 스크롤하면서 확인할 때 컬럼 정보를 놓치지 않음
   - 사용자 정의 스크롤바 스타일링으로 스크롤 가능한 영역을 시각적으로 명확히 인식할 수 있음
   - CVE 목록이 많아도 페이지 전체 길이는 일정하게 유지되어 페이지 탐색이 용이해짐
   - 취약점 정보에 직접 Vulners 데이터베이스 링크가 포함되어 더 자세한 정보를 즉시 확인할 수 있음
   - **Searchsploit 결과에서 바로 exploit 파일을 다운로드할 수 있어 추가 검색 없이 빠르게 exploit 코드를 확인할 수 있음**

### 2025-06-09: 기능 추가 - Searchsploit 결과 파일 다운로드 기능

1. **문제점**:
   - Searchsploit 결과에서 파일 경로가 표시되지만, 해당 파일을 직접 다운로드할 수 없었습니다.
   - 사용자가 파일 내용을 확인하려면 서버에 직접 접속하거나 exploit-db 웹사이트를 방문해야 했습니다.

2. **구현 사항**:
   - 프론트엔드:
     - `api.ts`에 exploit 파일 다운로드 함수 추가
     - 파일 경로를 클릭하면 다운로드되도록 UI 수정
     - 다운로드 오류 처리 및 피드백 추가
   
   - 백엔드:
     - `ExploitSearcher` 클래스에 파일 읽기 기능 추가
     - `/exploit-file` API 엔드포인트 추가
     - 파일 경로 검증 및 보안 검사 구현
     - 적절한 MIME 타입으로 파일 다운로드 제공

3. **이점**:
   - 사용자가 Searchsploit 결과에서 바로 exploit 파일을 다운로드할 수 있습니다.
   - 추가 검색이나 복잡한 과정 없이 exploit 코드를 쉽게 확인할 수 있습니다.
   - 파일 형식에 맞는 적절한 MIME 타입으로 다운로드되어 브라우저에서 바로 확인 가능합니다.

## 최근 업데이트

### 2023.XX.XX - UI 용어 변경: '보고서'를 '리포트'로 통일
- 프론트엔드 전체에서 '보고서'라는 용어를 '리포트'로 변경하여 일관성 있는 용어 사용
- 주요 변경 파일:
  - `types/index.ts`: 타입 정의의 명칭 변경
  - `services/api.ts`: API 서비스 관련 메서드 및 주석 변경
  - `features/VulnerabilityResults.tsx`: 리포트 생성 UI 및 로직 변경
  - `features/ScanHistory.tsx`: 스캔 및 리포트 목록 화면 변경 
  - `features/ReportDetail.tsx`: 리포트 상세 화면 변경
- 백엔드 API 경로는 변경하지 않고 프론트엔드에서만 표시 이름을 변경

### 2023.XX.XX - 보고서 생성 버그 수정
- 취약점 분석 결과가 보고서에 제대로 표시되지 않는 문제 수정
- 문제 원인: 이미 취약점 정보가 있는 스캔 데이터를 다시 분석하는 과정에서 정보 손실 발생
- 개선 내용:
  - 스캔 데이터에 이미 취약점 정보가 있는 경우 추가 분석 스킵
  - 취약점 정보가 없는 경우에만 분석 실행
  - 디버깅 로그 추가하여 보고서 생성 과정 추적 가능
  - 취약점 개수를 정확히 계산하도록 로직 개선

## 프로젝트 구조

### 백엔드
- `app.py`: 메인 애플리케이션 진입점
- `routes.py`: API 엔드포인트 정의
- `scanner.py`: Nmap 스캐닝 및 취약점 분석 기능
- `storage.py`: 데이터 저장 및 관리 기능
- `vpn_manager.py`: VPN 연결 관리

### 프론트엔드
- `/src/features`: 주요 기능 컴포넌트
  - `ScanForm.tsx`: 스캔 설정 및 실행
  - `ScanResults.tsx`: 스캔 결과 표시
  - `VulnerabilityResults.tsx`: 취약점 분석 결과 표시
  - `ScanHistory.tsx`: 과거 스캔 기록 관리
- `/src/store`: Redux 상태 관리
  - `scanSlice.ts`: 스캔 관련 상태 관리
  - `vulnerabilitySlice.ts`: 취약점 분석 상태 관리

## 기술 스택
- 백엔드: Flask (Python)
- 프론트엔드: React, TypeScript, Redux
- UI: Tailwind CSS, shadcn/ui
- 네트워크 스캐닝: Nmap
- 취약점 분석: Vulners, Vulscan 스크립트

## 설치 및 실행

### 백엔드
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
```