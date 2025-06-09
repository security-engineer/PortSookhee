import os
import sys
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

# 현재 디렉토리를 Python 경로에 추가
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from storage import LocalStorage
from vpn_manager import VPNManager
from exploit_searcher import ExploitSearcher
from routes import api

# 환경 변수 로드
load_dotenv()

# Flask 앱 인스턴스 생성
app = Flask(__name__)
CORS(app)  # CORS 설정

# 데이터 및 설정 디렉토리 경로 설정
base_dir = os.path.abspath(os.path.dirname(__file__))
data_path = os.path.join(base_dir, 'data')
vpn_configs_path = os.path.join(base_dir, 'vpn_configs')

# 애플리케이션의 핵심 컴포넌트들 초기화
storage = LocalStorage(data_dir=data_path)
vpn_manager = VPNManager(config_dir=vpn_configs_path, storage_manager=storage)
exploit_searcher = ExploitSearcher()

# 앱 설정에 객체들 등록
app.config['STORAGE'] = storage
app.config['VPN_MANAGER'] = vpn_manager
app.config['EXPLOIT_SEARCHER'] = exploit_searcher

# 블루프린트 등록
app.register_blueprint(api, url_prefix='/api')

# 기본 홈 라우트
@app.route('/')
def index():
    return "백엔드 서버가 실행 중입니다."

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

"""
실행 방법:
1. 직접 실행: python app.py
2. Flask CLI로 실행 ('backend' 디렉토리에서): 
   - 환경변수 설정: set FLASK_APP=app.py 
   - 디버그 모드: set FLASK_DEBUG=1 
   - 서버 시작: flask run
""" 