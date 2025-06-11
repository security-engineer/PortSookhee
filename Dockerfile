
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

# 필수 패키지 설치
RUN apt-get update && apt-get install -y \
    libsndfile1 iproute2 psmisc procps \
    libssl-dev zlib1g-dev libbz2-dev libreadline-dev \
    libsqlite3-dev libncursesw5-dev libffi-dev liblzma-dev \
    uuid-dev curl wget vim neovim \
    libsndfile1 libavformat-dev libavcodec-dev \
    libavfilter-dev libavdevice-dev libavutil-dev \
    libswscale-dev build-essential npm nmap openvpn && \
    rm -rf /var/lib/apt/lists/*
    
RUN apt update && apt install build-essential

# 작업 디렉토리 설정
WORKDIR /workspace

# Python 패키지 설치
COPY ./backend ./backend


# 포트 노출
EXPOSE 5000


# Ollama 및 서버 실행
CMD ["bash"]