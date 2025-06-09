from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os

def create_app(test_config=None):
    # 환경 변수 로드
    load_dotenv()
    
    # Flask 인스턴스 생성
    app = Flask(__name__, instance_relative_config=True)
    
    # 기본 설정
    app.config.from_mapping(
        SECRET_KEY=os.environ.get('SECRET_KEY', 'dev_key_only_for_development'),
        DATABASE=os.path.join(app.instance_path, 'scanner.sqlite'),
    )
    
    # 테스트 설정 적용 (있는 경우)
    if test_config is not None:
        app.config.from_mapping(test_config)
    
    # instance 폴더 생성
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
    
    # CORS 설정 적용
    CORS(app)
    
    # API 블루프린트 등록
    from backend.routes import api
    app.register_blueprint(api, url_prefix='/api')
    
    # 기본 라우트
    @app.route('/')
    def home():
        return {
            "status": "success",
            "message": "네트워크 취약점 분석 시스템 API가 실행 중입니다."
        }
    
    return app 