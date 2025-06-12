# Frontend 구동 방법.

### 1. nodejs 설치.
설치는 알아서 부탁함..

### 2. front 폴더안에 들어가서 터미널 키고 `npm install` 을 입력하여 의존성 설치
### 3. `npm start` 해서 프론트 서버 구동.

# Backend 구동 방법.

docker Desktop을 설치 후 터미널을 키고

### 1. (선택사항) `docker login` 로 docker 로그인 
### 2. `docker run --privileged -it -p 5000:5000 --name ps --cap-add=NET_ADMIN --device=/dev/net/tun tomgorani/ps:2.4' 로 docker image 설치
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

### 2025-06-18: 프로필 추가 기능 버그 수정

1. **문제 해결**:
   * 새 프로필 추가 시, 이름을 입력하고 '추가' 버튼을 눌러도 "프로필 이름 'profile_name'이 필요합니다." 라는 오류 메시지가 뜨면서 기능이 동작하지 않는 버그를 해결했습니다.

2. **원인 분석**:
   * 프론트엔드에서 백엔드로 API 요청을 보낼 때, 본문(body)에 포함되는 프로필 이름의 필드 키(key)가 잘못 지정되어 있었습니다.
   * 프론트엔드에서는 `name`으로 보내고 있었으나, 백엔드에서는 `profile_name`을 기대하고 있어 데이터 불일치가 발생했습니다.

3. **구현 방법**:
   * `front/src/services/api.ts` 파일의 `createProfile` 함수를 수정했습니다.
   * `axios.post` 요청의 본문을 `{ name: profileName }` 에서 `{ profile_name: profileName }`으로 변경하여 백엔드의 요구사항에 맞췄습니다.

4. **이점**:
   * 사용자가 정상적으로 새 프로필을 생성하고 관리할 수 있게 되었습니다.
   * 프론트엔드와 백엔드 간의 데이터 통신 규격이 일치되어 시스템 안정성이 향상되었습니다.

### 2025-06-18: 프로필 삭제 기능 추가

1. **기능 추가**:
   * 사용자가 생성한 프로필을 삭제할 수 있는 기능을 `ProfileSelector` 컴포넌트에 추가했습니다.
   * 프로필 목록의 각 항목에 마우스를 올리면 삭제 아이콘이 나타납니다.
   * 실수로 인한 삭제를 방지하기 위해, 삭제 버튼 클릭 시 확인 창을 통해 재차 확인하는 절차를 추가했습니다.

2. **구현 방법**:
   * **API 서비스**: `front/src/services/api.ts`에 `deleteProfile` 함수를 추가하여 백엔드에 프로필 삭제를 요청하는 API 호출을 구현했습니다.
   * **컴포넌트 로직**: `front/src/components/ProfileSelector.tsx`에 `handleDeleteProfile` 함수를 추가하여 API 호출 및 상태 업데이트(목록 새로고침, 오류 처리)를 담당하도록 했습니다.
   * **UI/UX**:
     * `lucide-react`의 `Trash2` 아이콘을 사용하여 삭제 버튼을 시각적으로 표현했습니다.
     * `default` 프로필과 현재 활성화된 프로필은 삭제할 수 없도록 버튼을 비활성화/숨김 처리하여 시스템 안정성을 확보했습니다.
     * 마우스를 올렸을 때만 삭제 버튼이 보이도록 하여 깔끔한 UI를 유지했습니다.

3. **이점**:
   * 사용자가 더 이상 필요 없는 프로필을 직접 관리할 수 있게 되어 편의성이 향상되었습니다.
   * 안전장치를 통해 중요한 프로필이 삭제되는 것을 방지합니다.

### 2025-06-18: 웹사이트 타이틀 변경

1. **브랜딩 강화**:
   * 웹 브라우저 탭에 표시되는 기본 타이틀을 "React App"에서 "PortSookhee"로 변경하여 애플리케이션의 정체성을 명확히 했습니다.
   
2. **구현 방법**:
   * `front/public/index.html` 파일의 `<title>` 태그 내용을 `PortSookhee`로 직접 수정했습니다.

3. **이점**:
   * 사용자가 여러 탭을 열어두었을 때 애플리케이션을 쉽게 식별할 수 있습니다.
   * 애플리케이션의 브랜딩이 일관성 있게 유지됩니다.

### 2025-06-18: 네비게이션 바 로고 링크 기능 추가

1. **UI/UX 개선**:
   * 네비게이션 바의 로고 이미지와 "PortSookhee" 타이틀을 클릭 가능한 링크로 변경했습니다.
   * 이 링크를 클릭하면 애플리케이션의 메인 페이지(`/`)로 이동하여 사용자 편의성을 향상시켰습니다.
   * 로고 이미지와 텍스트를 수평으로 나란히 정렬하고 간격을 주어 시각적으로 개선했습니다.
   * 로고 이미지를 원형으로 만들어 디자인을 다듬었습니다.

2. **구현 방법**:
   * `front/src/App.tsx`에서 기존 `div` 요소를 `react-router-dom`의 `Link` 컴포넌트로 교체했습니다.
   * `Link` 컴포넌트의 `to` 속성을 `/`로 설정하여 홈페이지로 라우팅되도록 했습니다.
   * `Tailwind CSS` 유틸리티 클래스(`flex`, `items-center`, `gap-2`, `rounded-full`)를 사용하여 레이아웃과 스타일을 적용했습니다.

3. **이점**:
   * 사용자가 어떤 페이지에 있든 로고를 클릭하여 쉽고 빠르게 홈페이지로 돌아갈 수 있습니다.
   * 헤더 디자인이 더 깔끔하고 직관적으로 개선되었습니다.

### 2025-06-18: 네트워크 토폴로지 줌 기능 개선

1. **사용자 경험 개선**:
   * 마우스 휠을 이용한 줌인/줌아웃 속도를 높여 더 빠른 탐색이 가능하도록 수정.
   * 줌인/줌아웃 버튼의 확대/축소 비율을 조정하여 더 부드럽고 점진적인 줌 효과를 제공.
   * 줌아웃 버튼이 줌인으로 동작하던 버그 수정.

2. **구현 방법**:
   * `NetworkTopology.tsx` 파일의 Cytoscape.js 설정 수정:
     * `wheelSensitivity` 값을 `0.15`에서 `0.3`으로 상향 조정하여 휠 반응 속도 개선.
   * 줌 버튼 이벤트 핸들러(`handleZoomIn`, `handleZoomOut`) 로직 수정:
     * 줌 배율을 기존의 `10`에서 `1.2`로 변경하여 더 세밀한 컨트롤 가능.
     * `handleZoomOut`이 나누기(`/`) 연산을 하도록 수정하여 정상적으로 축소되도록 함.

3. **이점**:
   * 사용자가 토폴로지 맵을 더 빠르고 부드럽게 탐색할 수 있게 됨.
   * 비정상적으로 동작하던 줌 버튼 기능 정상화.
   * 전체적인 UI 조작성과 사용자 만족도 향상.

### 2025-06-18: 네트워크 토폴로지 노드 배경 렌더링 버그 수정

1. **문제 해결**:
   * 노드 뒤에 불필요한 사각형 배경이 나타나는 시각적 결함 수정.
   * 이는 기본 `node` 스타일에 있던 `background-color`가 의도치 않게 렌더링되어 발생한 문제였습니다.

2. **구현 방법**:
   * `NetworkTopology.tsx`의 Cytoscape 스타일링 로직 수정.
   * 기본 `node` 셀렉터에서 `background-color` 속성을 제거하여 기본 배경을 투명하게 처리.
   * 각 위험도별 클래스(`.high-risk` 등)와 `.central-node`에서만 `background-color`를 설정하도록 하여, 해당 모양(ellipse)에만 배경색이 적용되도록 함.

3. **이점**:
   * 불필요한 사각형 배경이 완전히 제거되어 깔끔하고 정확한 노드 시각화 구현.
   * 스타일 상속 및 적용 규칙을 명확히 하여 코드의 예측 가능성 및 유지보수성 향상.

### 2025-06-18: 네트워크 토폴로지 노드 스타일링 버그 수정

1. **문제 해결**:
   * 노드 배경색이 위험도에 따라 변경되지 않고 테두리 색상만 바뀌는 문제 해결
   * 노드 뒤에 사각형 배경이 나타나는 시각적 결함 수정

2. **구현 방법**:
   * `NetworkTopology.tsx`의 Cytoscape 스타일링 로직 수정
   * 각 위험도(`.high-risk`, `.medium-risk`, `.low-risk`)에 맞는 `background-color`를 명시적으로 설정
     * 고위험: `#fee2e2` (연한 빨강)
     * 중간위험: `#fff7ed` (연한 주황)
     * 저위험: `#f0fdf4` (연한 녹색)
   * `node:hover` 시에도 위험도에 따라 배경색이 변경되도록 수정
   * 불필요하고 렌더링 문제를 유발할 수 있는 `border-radius` 속성을 모든 노드 스타일에서 제거

3. **이점**:
   * 사용자가 노드의 위험도를 색상으로 즉시 파악 가능
   * 불필요한 사각형 배경이 사라져 깔끔한 원형 노드 렌더링
   * 전체적인 토폴로지 UI의 시각적 일관성 및 가독성 향상

### 2025-06-18: 네트워크 토폴로지 노드 모양 원형으로 변경

1. **UI 변경 사항**:
   * 네트워크 토폴로지의 모든 노드 모양을 사각형에서 원형으로 변경
   * 기존 'round-rectangle' 모양의 일반 노드를 'ellipse'로 통일
   * 중앙 노드와 일반 노드의 모양을 일관성 있게 원형으로 유지

2. **구현 방법**:
   * `NetworkTopology.tsx` 파일의 Cytoscape 스타일 설정에서 노드 모양 속성 수정
   * 모든 노드에 대한 'shape' 속성을 'ellipse'로 변경
   * 기존의 그림자 효과, 색상 및 기타 스타일 속성은 유지

3. **이점**:
   * 더 깔끔하고 일관된 시각적 디자인 제공
   * 원형 노드가 네트워크 토폴로지에서 더 직관적인 시각적 표현 제공
   * 사용자 피드백을 반영한 UI 개선으로 사용자 경험 향상

### 2025-06-17: ReportDetail 컴포넌트 report_id 누락 버그 수정

1. **문제 해결**:
   * 리포트 상세 페이지에서 "이 리포트는 ID가 없어 토폴로지에 추가할 수 없습니다. 관리자에게 문의하세요." 메시지가 잘못 표시되는 문제 해결
   * `ReportDetail.tsx` 파일에서 `currentReport.report_id` 속성 접근 시 안전성 검사가 누락된 문제 수정
   * 조건부 렌더링에서 `currentReport` 객체 자체의 존재 여부 검사 로직 추가

2. **구현 방법**:
   * 486라인의 조건문을 `{currentReport.report_id ? (` 에서 `{currentReport && currentReport.report_id ? (` 로 수정
   * 객체가 존재하는지 먼저 확인한 후 속성에 접근하도록 하여 타입 안전성 확보
   * 리포트 데이터가 정상적으로 로드되었지만 report_id가 없는 경우와 리포트 객체 자체가 없는 경우를 모두 처리

3. **이점**:
   * 사용자가 리포트 상세 페이지에서 토폴로지에 리포트를 추가할 때 발생하던 오류 메시지 문제 해결
   * 타입스크립트의 옵셔널 체이닝을 활용한 더 안전한 객체 속성 접근 방식 적용
   * 리포트 ID가 있는 경우에만 토폴로지 페이지로 이동하는 링크를 정상적으로 표시

4. **기술적 세부사항**:
   * Redux 상태 관리 시스템에서 `currentReport` 객체가 설정되는 과정에서 `report_id` 속성이 누락될 수 있는 가능성 고려
   * 조건부 렌더링 로직을 통해 다양한 데이터 상태에 대응하는 방어적 프로그래밍 적용
   * 사용자 경험 향상을 위해 적절한 안내 메시지 표시 로직 유지

### 2025-06-16: 네트워크 토폴로지 3D 인터랙티브 노드 UI 적용

1. **3D 효과 강화**:
   * 그림자 깊이(shadow-offset-y)를 활용한 입체감 있는 노드 디자인 구현
   * 노드별 위험도에 따른 차별화된 3D 그림자 효과 적용
   * 노드 크기 증가 및 모서리 라운딩 처리로 현대적인 디자인 적용
   * 호버 및 선택 상태에서 노드가 "떠오르는" 느낌의 애니메이션 효과

2. **인터랙션 애니메이션 개선**:
   * 노드 호버 시 부드러운 확대 및 그림자 변화 애니메이션
   * 선택 상태에서 노드 크기가 더 커지는 3D 피드백 효과
   * 엣지(연결선) 투명도 적용 및 호버 시 선명하게 변화
   * 노드와 엣지 모두에 상태 전환 애니메이션 적용

3. **레이아웃 및 애니메이션 최적화**:
   * COSE 레이아웃 알고리즘 파라미터 세밀하게 조정
   * cubic-bezier 기반의 고급 애니메이션 이징 적용
   * 애니메이션 지속 시간 연장으로 더 부드러운 전환 효과
   * 레이아웃 계산 시 라벨 크기 포함 옵션 활성화

4. **시각적 디자인 개선**:
   * 더 밝고 현대적인 배경색 사용
   * 중앙 노드의 크기 및 디자인 확대로 중요도 강조
   * 텍스트 가독성 향상을 위한 아웃라인 효과 강화
   * z-index 조정으로 레이어링 개선 및 입체감 증가

5. **성능 최적화**:
   * 그래픽 렌더링 최적화로 부드러운 애니메이션 효과
   * 상태 변화 시 변경되는 속성 최적화로 성능 향상
   * 줌 동작 민감도 및 애니메이션 조정
   * 리플로우 최소화로 렌더링 성능 개선

이 업데이트는 기존의 평면적인 네트워크 토폴로지 시각화를 현대적이고 인터랙티브한 3D 느낌의 UI로 변환하여, 사용자가 네트워크 요소 간의 관계와 중요도를 직관적으로 파악할 수 있도록 했습니다. 특히 위험도 높은 노드에 시각적 강조를 두어 보안 모니터링 경험을 향상시켰습니다.

### 2025-06-16: 네트워크 토폴로지 노드 디자인 개선

1. **UI 개선 사항**:
   * 노드 디자인을 완전히 새롭게 변경하여 더 현대적이고 세련된 시각적 효과 구현
   * 라운드 직사각형에서 부드러운 모서리와 그림자 효과가 있는 디자인으로 변경
   * 위험도에 따른 노드 색상 차별화 (고위험: 빨간색 계열, 중간 위험: 주황색 계열, 낮은 위험: 녹색 계열)
   * 중앙 노드는 타원형으로 변경하고 더 두드러진 파란색 배경 적용

2. **인터랙션 개선**:
   * 노드 호버 시 부드러운 애니메이션 효과와 배경색 변화 추가
   * 선택된 노드에 더 뚜렷한 테두리와 강조 효과 적용
   * 엣지(연결선) 디자인 개선 및 호버 시 두께 증가 효과 추가
   * 줌 속도와 민감도를 조정하여 더 자연스러운 사용자 경험 제공

3. **레이아웃 알고리즘 개선**:
   * COSE 레이아웃 알고리즘의 파라미터 최적화
   * 노드 간 간격과 배치를 더 균형있게 조정
   * 애니메이션 지속 시간과 이징(easing) 함수 추가로 더 부드러운 전환 효과
   * 레이아웃 초기화 시 과도한 노드 움직임 감소

4. **성능 개선**:
   * 렌더링 최적화로 더 부드러운 인터랙션 제공
   * 줌 민감도 조정으로 사용성 향상
   * 그래프 렌더링 시 z-index 조정으로 UI 요소 간 겹침 문제 해결

5. **기술적 구현**:
   * Cytoscape.js의 스타일 시스템을 활용한 디자인 구현
   * SVG 아이콘을 data URL로 변환하여 중앙 노드와 일반 노드에 적용
   * CSS 트랜지션과 애니메이션을 활용한 부드러운 상태 전환
   * 타입스크립트 오류 해결을 위한 타입 처리 개선

이러한 개선을 통해 네트워크 토폴로지 시각화가 더 직관적이고 세련된 디자인으로 업그레이드되어, 사용자가 네트워크 구조와 취약점을 더 쉽게 파악할 수 있게 되었습니다.

### 2025-06-15: Select 컴포넌트 사용 방식 오류 수정

1. **문제 해결**:
   * `ScanForm.tsx`에서 shadcn/ui의 `Select` 컴포넌트 사용 시 타입스크립트 오류 발생 문제 해결
   * 주요 오류: HTML select 속성(`id`, `onChange` 이벤트 핸들러)을 shadcn/ui의 `Select` 컴포넌트에 사용
   * `onChange`에서 매개변수 `e`의 타입이 지정되지 않은 문제도 함께 해결

2. **구현 방법**:
   * `Select` 컴포넌트 사용 방식을 shadcn/ui 방식으로 완전히 재구성:
     * HTML의 `id`, `onChange` 대신 `value`와 `onValueChange` 속성 사용
     * 기존의 옵션 요소 대신 `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` 컴포넌트 사용
   * 모든 import 구문을 개별 컴포넌트를 명시적으로 가져오는 방식으로 수정
   * 이벤트 핸들러 함수 대신 상태 설정 함수를 직접 `onValueChange`에 전달하여 타입 안전성 확보

3. **이점**:
   * 타입스크립트 컴파일 오류 해결로 코드 안정성 향상
   * shadcn/ui 컴포넌트의 올바른 사용법 적용으로 일관된 UI 경험 제공
   * 컴포넌트 간 데이터 흐름이 더 명확하고 타입 안전하게 개선됨
   * 스캔 유형 선택 기능이 정상적으로 작동하여 사용자가 다양한 스캔 옵션을 선택 가능

4. **향후 개선 방향**:
   * 다른 폼 컴포넌트들도 shadcn/ui 스타일 가이드에 맞게 일관되게 구현
   * 재사용 가능한 폼 컴포넌트로 추상화하여 코드 중복 감소
   * 어드민 페이지와 같은 다른 페이지에서도 동일한 Select 컴포넌트 사용법 적용

### 2025-06-14: 네트워크 토폴로지 UI 레이아웃 복원

1.  **문제 해결**:
    *   이전 코드 수정 과정에서 발생한 오류로 인해 `NetworkTopology.tsx` 컴포넌트의 오른쪽 패널(선택된 노드의 상세 정보를 보여주는 부분)이 사라지는 문제가 발생했습니다.
    *   컴포넌트의 JSX `return` 문이 조기에 종료되어 전체 레이아웃 구조가 깨진 것을 확인하고 이를 복원했습니다.

2.  **구현 방법**:
    *   `NetworkTopology.tsx` 파일의 `return` 문을 전체적으로 재구성하여, 왼쪽의 토폴로지 맵과 오른쪽의 상세 정보 패널이 나란히 표시되는 2단 그리드(`lg:grid-cols-2`) 레이아웃을 복원했습니다.
    *   `selectedNode` 상태에 따라 상세 정보 패널이 조건부로 렌더링되는 로직을 다시 추가했습니다.

3.  **이점**:
    *   **핵심 UI 복원**: 사용자가 토폴로지 맵에서 노드를 클릭했을 때 해당 노드의 상세 정보를 확인할 수 있는 핵심적인 사용자 인터페이스가 정상적으로 복원되었습니다.
    *   **사용자 경험 정상화**: 사라졌던 기능이 복원되어 사용자가 원활하게 네트워크 정보를 탐색할 수 있게 되었습니다.

### 2025-06-14: 네트워크 토폴로지 노드 색상 버그 및 데이터 불일치 문제 해결

1.  **문제 해결**:
    *   네트워크 토폴로지에서 리포트를 노드로 추가할 때, 위험 등급(CVSS 점수 기반)에 따라 노드 색상이 변경되지 않던 심각한 버그를 수정했습니다.
    *   디버깅 결과, `highRiskCount` 값은 정상적으로 계산되었으나, 새로 생성되는 노드(`newNode`) 객체의 `custom_data` 속성에 이 값이 전달되지 않아 스타일링 함수에서 `undefined`로 인식되는 것이 원인이었습니다.

2.  **해결 과정 및 장애물**:
    *   문제 해결을 위해 `onAddNode` 함수 내에서 `newNode`를 생성하는 부분에 `highRiskCount`를 추가하는 코드 수정을 시도했습니다.
    *   하지만 AI 어시스턴트의 `edit_file` 기능에 반복적인 문제가 발생하여, 코드 수정 요청이 제대로 반영되지 않거나 일부만 반영되는 현상이 지속되었습니다. (`console.log`만 삭제되고 핵심 수정 코드는 누락되는 등)
    *   `reapply` 기능을 통한 재시도 역시 실패하여, 코드 자동 수정이 불가능한 상황에 도달했습니다.

3.  **최종 해결책 (수동 적용)**:
    *   자동 수정의 한계로 인해, 개발자가 직접 코드를 수정하는 방식으로 문제를 해결했습니다.
    *   `front/src/features/NetworkTopology.tsx` 파일의 `onAddNode` 함수 전체를 아래와 같이 `highRiskCount`가 정상적으로 포함된 최종 코드로 교체했습니다.

    ```tsx
    const onAddNode = async (reportId: string) => {
      if (!cytoscapeRef.current) return;
  
      const centralNodeId = nodes.find(n => n.custom_data?.role === 'central')?.id;
      if (!centralNodeId) {
        console.error("Central node not found");
        return;
      }
  
      try {
        const reportToAdd = await dispatch(fetchReportById({ report_id: reportId, user_id: 'user1' })).unwrap();
        
        const highRiskCount = reportToAdd.details.vulnerabilities?.filter(v => v.risk === 'High').length || 0;
        const vulnCount = reportToAdd.details.vulnerabilities?.length || 0;
  
        const newNode: TopologyNode = {
          id: `report-${reportToAdd.report_id}`,
          label: `${reportToAdd.details.target || `report-${reportToAdd.report_id.slice(-8)}`}`,
          type: 'host',
          custom_data: {
            role: 'peripheral',
            report_id: reportToAdd.report_id,
            vulnCount: vulnCount,
            highRiskCount: highRiskCount, // 원인이었던 누락된 값을 추가
          },
        };
  
        const newEdge: TopologyEdge = {
          id: `edge-${centralNodeId}-${newNode.id}`,
          source: centralNodeId,
          target: newNode.id,
        };
  
        dispatch(addNodeAndEdge({ node: newNode, edge: newEdge }));
        
      } catch (error) {
        console.error('Failed to fetch report details for new node:', error);
      }
    };
    ```

4.  **이점**:
    *   새로 추가된 토폴로지 노드의 색상이 고위험 취약점 개수에 따라 정확하게 시각화됩니다.
    *   코드의 데이터 흐름이 명확해졌으며, 불필요한 디버깅 코드가 모두 제거되어 코드 가독성이 향상되었습니다.
    *   AI 코드 수정 기능의 한계점을 문서화하여, 향후 유사 문제 발생 시 참고 자료로 활용할 수 있습니다.