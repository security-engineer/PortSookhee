# Frontend 구동 방법.

### 1. nodejs 설치.
설치는 알아서 부탁함..

### 2. front 폴더안에 들어가서 터미널 키고 `npm install` 을 입력하여 의존성 설치
### 3. `npm start` 해서 프론트 서버 구동.

# Backend 구동 방법.

docker Desktop을 설치 후 터미널을 키고

### 1. (선택사항) `docker login` 로 docker 로그인 
### 2. `docker run --privileged -it -p 5000:5000 --name ps --cap-add=NET_ADMIN --device=/dev/net/tun tomgorani/ps:2.3' 로 docker image 설치
### 3. `docker exec -it ps bash` 로 컨테이너로 접속.
### 4. python 3.10.13 버전을 설치. 터미널에 복붙하면 됨.

cd /usr/src && \
    wget https://www.python.org/ftp/python/3.10.13/Python-3.10.13.tgz && \
    tar xzf Python-3.10.13.tgz && \
    cd Python-3.10.13 && \
    ./configure --enable-optimizations && \
    make -j$(nproc) && \
    make altinstall

### 5. exploit-db searchsploit 스크립트 설치. 터미널에 복붙하면 됨.

export PATH="/usr/local/bin:$PATH"
alias python=python3.10
alias pip=pip3.10

git clone https://gitlab.com/exploit-database/exploitdb.git ~/exploitdb

ln -s ~/exploitdb/searchsploit /usr/local/bin/searchsploit
chmod +x ~/exploitdb/searchsploit

echo 'export PATH="$PATH:$HOME/exploitdb"' >> ~/.bashrc
echo 'export EXPLOITDB_PATH="$HOME/exploitdb"' >> ~/.bashrc
source ~/.bashrc

exploit-db searchsploit 스크립트 설치.

### 6. Vulners, Vulscan 스크립트 설치. 터미널에 복붙하면 됨.

git clone https://github.com/vulnersCom/nmap-vulners.git
git clone https://github.com/scipag/vulscan.git
cp nmap-vulners/vulners.nse /usr/share/nmap/scripts/
cp -r vulscan /usr/share/nmap/scripts/
nmap --script-updatedb

### 7. `cd /workspace/backend` 로 이동.
### 8. `python -m venv venv` 로 가상환경 생성.
### 9. `source venv/bin/activate` 로 가상환경 실행.
### 10. `pip install -r requirements.txt` 로 의존성 설치.
### 11. `flask run --host 0.0.0.0` 을 컨테이너 터미널에 실행.



---
---
---


# PortSookhee - 네트워크 스캐너 프로젝트

이 프로젝트는 네트워크 스캐닝, 취약점 분석 및 보고서 생성 기능을 제공하는 웹 애플리케이션입니다.

## 주요 기능

1. Nmap을 활용한 네트워크 스캐닝
2. Vulners, Vulscan 스크립트를 통한 취약점 분석
3. 스캔 결과 및 취약점 분석 보고서 생성
4. 스캔 기록 관리
5. VPN 연결 관리
6. 네트워크 토폴로지 시각화

## 최근 수정 사항

### 2025-06-12: TopologyNode 인터페이스에서 'scanner' 타입 제거

1. **문제 해결**:
   - TopologyNode 인터페이스에서 더 이상 사용하지 않는 'scanner' 타입을 제거
   - 현재는 중앙 호스트 노드('main-host')와 일반 호스트 노드를 'host' 타입으로 통일하고, role 속성으로 구분

2. **구현 방법**:
   - TopologyNode 인터페이스의 type 필드에서 'scanner' 옵션을 제거하고 'host' | 'custom'만 허용
   - 'scanner' 타입 대신 custom_data.role 속성으로 노드 역할 구분

3. **이점**:
   - 더 일관된 타입 시스템 제공
   - 사용하지 않는 타입 옵션 제거로 코드 명확성 향상
   - 타입과 역할의 분리로 더 유연한 노드 분류 가능

### 2025-06-12: 리포트 상세 페이지의 객체 직접 렌더링 오류 수정

1. **문제 해결**:
   - 리포트 상세 페이지에서 PortInfo 객체를 직접 렌더링하여 "Objects are not valid as a React child" 오류가 발생하는 문제 해결

2. **구현 방법**:
   - 객체를 직접 출력하는 대신 객체의 속성을 문자열로 접근하여 출력하도록 수정
   - port.port, port.state, port.protocol 등의 속성에 안전하게 접근하도록 수정
   - 값이 없을 경우 기본값('N/A', 'unknown')을 제공하여 안전하게 렌더링

3. **이점**:
   - React 렌더링 오류 해결
   - 리포트 상세 페이지의 안정적인 렌더링 보장
   - 데이터 접근 및 표시 방식의 일관성 향상

### 2025-06-12: 사용자 토폴로지 탭의 Cytoscape 렌더링 오류 해결

1. **문제 해결**:
   - 사용자 토폴로지 탭에서 "Cannot read properties of null (reading 'notify')" 오류가 발생하는 문제 해결
   - 토폴로지 탭 전환 시 Cytoscape 인스턴스가 제대로 정리되지 않는 문제 해결
   - 비어있는 토폴로지나 유효하지 않은 엣지 처리 문제 개선

2. **구현 방법**:
   - CytoscapeComponent에 추가 안전장치 구현:
     - 요소가 비어있거나 노드가 없는 경우 조기 반환
     - 유효한 노드와 엣지만 필터링하는 강화된 검증 로직
     - 예외 처리 및 오류 로깅 추가
   - 탭 전환 시 Cytoscape 인스턴스 정리:
     - 이전 이벤트 리스너 제거
     - 인스턴스 메모리 정리 로직 추가
   - generateUserElements 함수 강화:
     - 비어있는 토폴로지 처리 로직 추가
     - 기본 노드 구조 제공하여 항상 유효한 그래프 구조 보장
   - processedElements 메모이제이션 함수 개선:
     - 오류 발생 시 안전한 폴백 제공
     - 엣지와 노드의 유효성 검사 강화

3. **이점**:
   - 사용자 토폴로지 탭에서 안정적인 그래프 렌더링 보장
   - 메모리 누수 방지로 장시간 사용 시에도 안정적인 성능 유지
   - 개발자 콘솔에 명확한 오류 메시지 제공으로 디버깅 용이성 향상
   - 유효하지 않은 데이터 구조에 대한 강건성 향상

### 2025-06-12: 일반 호스트 노드에 role 속성 추가

1. **문제 해결**:
   - 일반 호스트 노드의 custom_data 객체에 필수 속성인 'role'이 누락되어 타입 오류가 발생하는 문제 해결

2. **구현 방법**:
   - 일반 호스트 노드 생성 시 custom_data 객체에 `role: 'node'` 속성 추가
   - 중앙 노드와 일반 노드를 구분하기 위해 role 값을 'central'과 'node'로 구분

3. **이점**:
   - TopologyNode 인터페이스와의 완전한 호환성 확보
   - 노드 유형에 따른 명확한 구분으로 스타일링 및 동작 처리 용이
   - 타입 안전성 향상으로 개발 과정에서의 오류 감소

### 2025-06-12: TopologyNode 인터페이스 속성 일치 문제 해결

1. **문제 해결**:
   - 호스트 노드에 `custom_data` 속성이 누락되어 타입스크립트 오류가 발생하는 문제 해결
   - `os`, `ports`, `vulnCount`, `highRiskCount` 속성이 TopologyNode 인터페이스에 정의되지 않아 타입 오류가 발생하는 문제 해결
   - background-color 함수가 `undefined`를 반환할 수 있어 발생하는 오류 해결

2. **구현 방법**:
   - 일반 호스트 노드 생성 시 `custom_data` 속성을 추가
   - `os`, `ports`, `vulnCount`, `highRiskCount` 속성을 `custom_data` 객체 내부로 이동하여 TopologyNode 인터페이스와 일치시킴
   - background-color 함수가 중앙 노드인 경우에도 항상 색상 문자열을 반환하도록 수정
   - 노드 데이터 접근 방식을 `ele.data('custom_data')?.highRiskCount`로 수정하고 기본값 설정

3. **이점**:
   - 타입스크립트 컴파일 오류 해결로 안정적인 코드 실행 보장
   - 인터페이스와 구현 간의 일관성 유지로 코드 품질 향상
   - 데이터 구조의 일관성이 개선되어 유지보수성 향상
   - 호스트 노드의 속성을 custom_data에 표준화하여 확장성 개선

### 2025-06-11: 토폴로지 노드 타입 정의 수정 및 타입스크립트 오류 해결

1. **문제 해결**:
   - TopologyNode 인터페이스에 정의되지 않은 'central-host' 타입으로 인한 타입스크립트 오류 해결
   - 토폴로지의 중앙 노드 구분 방식 개선
   - 타입 안전성 향상

2. **구현 방법**:
   - 기존의 'central-host' 타입을 타입 정의에 맞는 'host' 타입으로 변경
   - 중앙 노드 구분을 위해 custom_data 필드에 role: 'central' 속성 추가
   - Cytoscape 스타일 선택자를 타입 대신 custom_data.role 속성을 기준으로 수정
   - 호스트 노드 스타일 적용 시 중앙 노드 우선 검사 로직 추가

3. **이점**:
   - 타입스크립트 안전성과 컴파일 시간 검증 강화
   - 중앙 노드 구분을 위한 보다 유연한 방식 도입
   - TopologyNode 인터페이스와의 호환성 유지
   - 코드 일관성 및 유지보수성 향상

### 2025-06-11: 토폴로지 그래프 렌더링 오류 및 엣지 생성 문제 해결

1. **문제 해결**:
   - `NetworkTopology` 컴포넌트에서 "Can not create edge with nonexistant source `main-host`" 오류 해결
   - react-cytoscapejs 모듈 의존성 문제 해결
   - 토폴로지 그래프의 안정적인 렌더링 구현

2. **구현 방법**:
   - cytoscape 라이브러리를 직접 사용하는 커스텀 CytoscapeComponent 구현
     - 외부 라이브러리 의존성 문제를 우회하며 더 많은 제어 가능
     - 컨테이너 참조(ref) 및 라이프사이클 관리 로직 추가
   - 노드-엣지 처리 순서 개선:
     - 노드를 먼저 생성한 후 엣지를 생성하는 순서 보장
     - 유효한 노드 ID를 확인한 후에만 엣지 생성
     - 유효하지 않은 엣지 필터링 로직 추가
   - `processedElements` 메모이제이션 함수 추가:
     - 노드와 엣지를 처리하여 항상 노드가 먼저 배치되도록 보장
     - 노드 ID 세트를 사용하여 유효한 엣지만 필터링
   - 스타일 적용 로직을 별도 함수로 분리하여 재사용성 개선

3. **이점**:
   - 그래프 렌더링 안정성 향상으로 사용자 경험 개선
   - 존재하지 않는 노드에 대한 엣지 생성 시도로 인한 오류 제거
   - 외부 라이브러리 의존성 없이 자체 구현으로 유지보수성 향상
   - 엣지와 노드의 처리 순서를 명확히 하여 일관된 그래프 렌더링 보장

### 2025-06-11: 메모리 최적화 및 취약점 분석 Out of Memory 오류 해결

1. **문제 해결**:
   - 취약점 분석 결과가 많을 때 브라우저 메모리 부족(Out of Memory) 오류가 발생하는 문제를 해결했습니다.
   - `NetworkTopology` 컴포넌트와 `VulnerabilityResults` 컴포넌트의 메모리 사용량을 대폭 개선했습니다.
   - 대용량 데이터 처리 시 브라우저가 안정적으로 동작하도록 최적화했습니다.

2. **구현 방법**:
   - `NetworkTopology.tsx` 파일의 데이터 구조 개선:
     - 더미 Cytoscape 컴포넌트가 아닌 실제 react-cytoscapejs 라이브러리를 사용하도록 수정
     - 불필요한 깊은 복사(deep copy) 제거 및 메모리 효율적인 데이터 구조 사용
     - 모든 취약점 정보를 메모리에 저장하는 대신 필요한 요약 정보만 저장
     - 상태 업데이트를 최적화하여 불필요한 리렌더링 감소
   
   - `VulnerabilityResults.tsx` 파일의 렌더링 최적화:
     - useMemo와 useCallback을 활용한 계산 결과 캐싱
     - 호스트 목록을 아코디언 형식으로 변경하여 한 번에 표시되는 데이터 양 감소
     - 호스트별 취약점 정보를 필요할 때만 렌더링하는 지연 로딩 구현
     - 포트별 최대 표시 취약점 수 제한(MAX_VULNERABILITIES_PER_PORT)
     - 긴 설명 텍스트와 스크립트 출력을 부분적으로만 표시하여 메모리 사용 절감

3. **이점**:
   - 대규모 스캔 결과(수백 개 이상의 취약점)도 안정적으로 처리 가능
   - 브라우저 메모리 사용량이 크게 감소하여 Out of Memory 오류 방지
   - 사용자 경험 향상: 데이터 로드 시간 단축 및 UI 반응성 개선
   - 호스트별 요약 정보를 먼저 보여주고 세부 정보는 필요 시 확장하는 방식으로 정보 탐색이 용이해짐

### 2025-06-11: TopologyNode 인터페이스에 state 필드 추가

1. **문제 해결**:
   - 토폴로지 맵에서 노드의 상태(state) 정보를 표시하기 위해 TopologyNode 인터페이스에 state 필드를 추가했습니다.
   - `topologySlice.ts`에서 호스트 노드 생성 시 state 필드를 사용하여 호스트의 상태(up/down)를 표시할 수 있게 되었습니다.
   - 이전에는 타입 에러가 발생하여 토폴로지 맵에 호스트 상태를 표시할 수 없었습니다.

2. **구현 방법**:
   - `front/src/types/index.ts` 파일의 TopologyNode 인터페이스에 `state?: string` 필드를 추가했습니다.
   - 중앙 호스트 노드와 스캔된 호스트 노드에 state 필드를 사용하여 호스트 상태를 표시할 수 있게 되었습니다.

3. **이점**:
   - 토폴로지 맵에서 각 호스트의 상태(up/down)를 시각적으로 확인할 수 있습니다.
   - 스캔 결과에서 발견된 호스트의 상태가 토폴로지 맵에 정확하게 반영됩니다.
   - 타입 안전성이 향상되어 개발 과정에서의 오류를 줄일 수 있습니다.

### 2025-06-10: 토폴로지 맵 구조 개선 및 중앙 호스트 노드로 변경

1. **구조적 개선**:
   - 중앙에 스캐너 노드 대신 기본 호스트 노드를 배치하는 방식으로 변경했습니다.
   - 스캔 시 자동으로 기본 호스트 노드와 연결된 노드가 추가되도록 구현했습니다.
   - 레이아웃 알고리즘을 concentric에서 cose로 변경하여 복잡한 토폴로지에도 최적화된 시각화를 제공합니다.

2. **구현 방법**:
   - `topologySlice.ts`에서 초기화 시 생성되는 기본 노드를 스캐너에서 호스트로 변경했습니다.
   - `addScanToTopology` 액션을 추가하여 스캔 결과가 변경될 때마다 자동으로 토폴로지에 반영하도록 했습니다.
   - 노드 연결 구조를 스캐너-호스트에서 중앙호스트-대상호스트로 변경했습니다.
   - 중앙 호스트 노드는 육각형 모양으로 표시하여 쉽게 구분할 수 있게 했습니다.

3. **이점**:
   - 더욱 직관적인 네트워크 토폴로지 구조 제공
   - 사용자 중심의 네트워크 시각화로 관계 파악이 용이함
   - 스캔 결과가 자동으로 토폴로지에 반영되어 사용자 경험 개선
   - 복잡한 네트워크 구조에서도 효율적인 시각화 제공

### 2025-06-10: 사용자별 네트워크 토폴로지 기능 추가 및 리포트 연동 구현

1. **기능 개선**:
   - 네트워크 토폴로지 맵을 사용자별로 저장하는 기능 추가
   - 리포트 생성 후 '토폴로지 노드 추가' 버튼을 통해 토폴로지 맵에 노드 추가 기능 구현
   - 추가된 노드를 클릭하면 리포트 상세 정보를 오른쪽 패널에서 확인 가능
   - 스캔 토폴로지와 사용자 토폴로지를 탭으로 구분하여 관리할 수 있는 인터페이스 제공

2. **구현 방법**:
   - Redux 상태 관리에 `topologySlice.ts` 추가하여 사용자별 토폴로지 데이터 관리
   - 로컬 스토리지를 활용한 토폴로지 데이터 영구 저장 구현
   - `TopologyNode`, `TopologyEdge`, `UserTopology` 타입 정의 추가
   - 리포트 상세 페이지와 취약점 결과 페이지에 '토폴로지 노드 추가' 버튼 통합
   - 사용자 토폴로지 탭에서 노드 클릭 시 해당 리포트의 요약 정보 표시

3. **개선 효과**:
   - 사용자가 중요한 스캔 결과와 리포트를 시각적 네트워크 맵에 저장하여 나중에 다시 확인 가능
   - 시간에 따른 네트워크 변화와 취약점 추이를 사용자 토폴로지 맵을 통해 시각적으로 추적 가능
   - 리포트와 토폴로지 맵의 연동으로 인사이트를 더욱 효과적으로 확인 가능
   - 메인 페이지에서 바로 토폴로지 현황을 확인할 수 있어 사용자 경험 향상

### 2025-06-10: HomePage에 네트워크 토폴로지 컴포넌트 추가

1. **개선 내용**:
   - 메인 페이지(HomePage)에 NetworkTopology 컴포넌트를 추가하여 사용자가 즉시 네트워크 토폴로지를 확인할 수 있도록 개선했습니다.
   - 기존에는 별도 페이지로 이동해야만 네트워크 토폴로지를 볼 수 있었으나, 이제 메인 페이지에서 직접 확인 가능합니다.

2. **구현 방법**:
   - `HomePage.tsx`에 `NetworkTopology` 컴포넌트를 임포트했습니다.
   - 기존 소개 카드 아래에 NetworkTopology 컴포넌트를 배치했습니다.
   - 컴포넌트는 기존 데이터 흐름을 그대로 유지하며 Redux 상태를 활용합니다.

3. **이점**:
   - 사용자가 메인 페이지에 접속하자마자 최근 스캔 결과의 네트워크 토폴로지를 즉시 확인 가능합니다.
   - 별도 페이지 이동 없이 네트워크 상태와 취약점 분포를 시각적으로 파악할 수 있습니다.
   - 시스템의 핵심 기능인 네트워크 시각화를 더 강조하여 사용자 경험이 향상되었습니다.

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