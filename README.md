# Frontend 구동 방법.

### 1. nodejs 설치.
`https://nodejs.org/ko/download`

### 2. front 폴더안에 들어가서 터미널 키고 `npm install` 을 입력하여 의존성 설치
### 3. `npm start` 해서 프론트 서버 구동.

# Backend 구동 방법.

docker Desktop을 설치 후 터미널을 키고

### 1. (선택사항) `docker login` 로 docker 로그인 
### 2. `docker run --privileged -it -p 5000:5000 --name ps --cap-add=NET_ADMIN --device=/dev/net/tun tomgorani/ps:2.4` 로 docker image 설치
### 3. `docker exec -it ps bash` 로 컨테이너로 접속.

# 이제부터 컨테이너 상에서 명령어를 실행하면 됩니다.

### 7. `cd /workspace/backend` 로 이동.
### 8. `python -m venv venv` 로 가상환경 생성.
### 9. `source venv/bin/activate` 로 가상환경 실행.
### 10. 가상환경이 성공적으로 실행되면 backend 폴더내에서 `pip install -r requirements.txt` 로 의존성 설치해주세요.
### 11. `flask run --host 0.0.0.0` 을 컨테이너 터미널에 실행하면 백엔드 구동이 성공적으로 끝납니다.
