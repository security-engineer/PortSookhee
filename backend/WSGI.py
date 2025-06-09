"""
WSGI 엔트리 포인트 - 서버 배포용
"""

import sys
import os

# 현재 백엔드 디렉토리를 Python 경로에 추가
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# app.py의 app 객체 가져오기
from app import app

# WSGI 호환성을 위한 application 변수 지정
application = app

if __name__ == "__main__":
    app.run() 