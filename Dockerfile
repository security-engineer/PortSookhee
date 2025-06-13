
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Seoul

# 필수 패키지 설치
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    libsndfile1 iproute2 psmisc procps \
    libssl-dev zlib1g-dev libbz2-dev libreadline-dev \
    libsqlite3-dev libncursesw5-dev libffi-dev liblzma-dev \
    uuid-dev curl wget vim neovim \
    libsndfile1 libavformat-dev libavcodec-dev \
    libavfilter-dev libavdevice-dev libavutil-dev \
    libswscale-dev build-essential npm nmap openvpn && \
    rm -rf /var/lib/apt/lists/*
    
RUN apt update && apt upgrade -y && apt install build-essential

RUN cd /usr/src && \
    wget https://www.python.org/ftp/python/3.10.13/Python-3.10.13.tgz && \
    tar xzf Python-3.10.13.tgz && \
    cd Python-3.10.13 && \
    ./configure --enable-optimizations && \
    make -j"$(nproc)" && \
    make altinstall && \
    ln -s /usr/local/bin/python3.10 /usr/local/bin/python && \
    ln -s /usr/local/bin/pip3.10    /usr/local/bin/pip && \
    cd / && rm -rf /usr/src/Python-3.10.13*

RUN git clone https://gitlab.com/exploit-database/exploitdb.git /opt/exploitdb && \
    ln -s /opt/exploitdb/searchsploit /usr/local/bin/searchsploit && \
    chmod +x /opt/exploitdb/searchsploit

ENV PATH="/usr/local/bin:/opt/exploitdb:${PATH}" \
    EXPLOITDB_PATH="/opt/exploitdb"


RUN git clone https://github.com/vulnersCom/nmap-vulners.git /tmp/nmap-vulners && \
    git clone https://github.com/scipag/vulscan.git      /tmp/vulscan      && \
    cp /tmp/nmap-vulners/vulners.nse /usr/share/nmap/scripts/               && \
    cp -r /tmp/vulscan                 /usr/share/nmap/scripts/             && \
    nmap --script-updatedb && \
    rm -rf /tmp/nmap-vulners /tmp/vulscan

# 작업 디렉토리 설정
WORKDIR /workspace

# Python 패키지 설치
COPY ./backend ./backend

# 포트 노출
EXPOSE 5000

# Ollama 및 서버 실행
CMD ["bash"]