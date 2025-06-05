from flask import Flask, g, request, jsonify
from flask_cors import CORS
from flask_pymongo import PyMongo
import os
import logging
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from pymongo import MongoClient
import uuid
import jwt
import bcrypt
from datetime import datetime, timedelta
from .config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Disable pymongo debug logs
logging.getLogger('pymongo').setLevel(logging.WARNING)

# MongoDB Configuration
MONGO_URI = os.environ.get('MONGODB_URL', 'mongodb://165.229.86.157:8080/PortSookhee')
DATABASE_NAME = os.environ.get('MONGODB_DB', 'PortSookhee')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your_jwt_secret_key')
JWT_EXPIRATION = int(os.environ.get('JWT_EXPIRATION', 86400))  # 24시간 (초)

# 글로벌 변수 - 메모리 기반 임시 데이터 (삭제)
memory_db = None

# MongoDB 인스턴스
mongo = PyMongo()

# MongoDB 연결 상태
mongodb_available = False

# 개발 환경 여부 확인
IS_DEVELOPMENT = os.environ.get('FLASK_ENV') == 'development'

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # MongoDB URI 설정
    app.config['MONGO_URI'] = MONGO_URI
    
    # 개발 모드 강제 설정 (인증 우회 목적)
    app.config['DEVELOPMENT'] = True
    os.environ['FLASK_ENV'] = 'development'
    
    # 디버그: 설정된 URI 확인
    logger.info(f"Configured MongoDB URI: {app.config['MONGO_URI']}")
    
    # CORS 설정 단순화 - 모든 요청 허용
    CORS(app, 
         resources={r"/*": {"origins": "*"}},
         supports_credentials=False,
         send_wildcard=True
    )
    
    # 로그로 CORS 설정 확인
    logger.info("CORS 설정이 적용되었습니다 (모든 출처 및 헤더 허용)")
    
    # 기본 라우트 추가 (서버 상태 확인용)
    @app.route('/api/', methods=['GET', 'HEAD', 'OPTIONS'])
    def health_check():
        """서버 상태 확인 엔드포인트"""
        if request.method == 'OPTIONS':
            # CORS 프리플라이트 요청 처리
            return '', 200
        return jsonify({'status': 'ok', 'message': 'Server is running'})
    
    # 헬스 체크 엔드포인트 추가
    @app.route('/api/health', methods=['GET', 'HEAD', 'OPTIONS'])
    def api_health():
        """API 헬스 체크 엔드포인트"""
        return jsonify({
            'status': 'ok', 
            'message': 'API server is running',
            'version': '1.0.0',
            'time': datetime.now().isoformat()
        })
    
    # MongoDB 연결 변수
    global mongodb_available
    
    # Initialize MongoDB with error handling
    try:
        logger.info(f"Attempting to connect to MongoDB at {app.config['MONGO_URI']}")
        
        # 연결 세부 정보 로깅
        logger.info(f"MongoDB URI: {app.config['MONGO_URI']}")
        logger.info(f"MongoDB Database: {DATABASE_NAME}")
        
        # Flask-PyMongo 초기화
        mongo.init_app(app)
        logger.info("mongo.init_app(app) completed")
        
        # 연결 테스트를 위한 앱 컨텍스트 설정
        with app.app_context():
            # 단계별 테스트
            logger.info("Testing MongoDB connection...")
            
            # 1. MongoDB 연결 객체 확인
            if mongo.cx is None:
                logger.error("mongo.cx is None - connection failed")
                raise ConnectionError("MongoDB connection object is None")
            else:
                logger.info(f"MongoDB connection established: {mongo.cx}")
                
            # 2. DB 객체 확인
            if mongo.db is None:
                logger.error("mongo.db is None - database access failed")
                raise ConnectionError("MongoDB database object is None")
            else:
                logger.info(f"MongoDB database accessed: {mongo.db}")
            
            # 3. ping 명령으로 서버 연결 확인
            logger.info("Sending ping command...")
            ping_result = mongo.db.command('ping')
            logger.info(f"Ping result: {ping_result}")
            
            # 4. DB 정보 확인
            db_info = mongo.db.command('dbStats')
            logger.info(f"Connected to MongoDB database: {db_info.get('db')} with {db_info.get('collections')} collections")
            
            # 5. 컬렉션 목록 확인
            collections = mongo.db.list_collection_names()
            logger.info(f"Available collections: {collections}")
            
            # 6. users 컬렉션 확인
            if 'users' in collections:
                users_count = mongo.db.users.count_documents({})
                logger.info(f"Found users collection with {users_count} documents")
                
                # 첫 번째 사용자 확인 (디버깅용)
                if users_count > 0:
                    sample_user = mongo.db.users.find_one()
                    if sample_user:
                        # 비밀번호 필드는 로깅하지 않음
                        if 'password' in sample_user:
                            sample_user['password'] = '***MASKED***'
                        logger.info(f"Sample user: {sample_user}")
            else:
                logger.warning("'users' collection not found in database!")
            
            mongodb_available = True
            logger.info("MongoDB connection fully verified and ready")
            
            # Setup database indexes
            setup_database(mongo.db)
            
            # 앱에 MongoDB 설정 추가 (향후 접근용)
            app.config['MONGO'] = mongo
            app.config['MONGO_DB'] = mongo.db
            
    except Exception as e:
        logger.error(f"Failed to initialize MongoDB: {str(e)}")
        logger.error(f"Exception type: {type(e)}")
        logger.error(f"Stack trace:", exc_info=True)
        mongodb_available = False
        # 심각한 오류가 아니면 앱 시작 계속 진행
        logger.warning("MongoDB 연결에 실패했지만 앱은 계속 실행됩니다. 일부 기능이 제한될 수 있습니다.")
    
    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.scan_routes import scan_bp
    from .routes.openvpn_routes import openvpn_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(main_bp, url_prefix='/api')
    app.register_blueprint(scan_bp, url_prefix='/api/scan')
    app.register_blueprint(openvpn_bp, url_prefix='/api/openvpn')
    
    # 모든 응답에 CORS 헤더 추가하는 after_request 핸들러
    @app.after_request
    def add_cors_headers(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Skip-Auth,X-Admin-Access')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response
    
    # Request hooks
    @app.before_request
    def before_request():
        """요청 처리 전 MongoDB 사용 가능 여부를 g 객체에 저장하고, 인증 토큰 확인"""
        # 요청 로깅 (디버깅)
        logger.info(f"Request: {request.method} {request.path}, {request.headers.get('Origin', 'No Origin')}")
        
        g.mongodb_available = mongodb_available

        # 인증이 필요하지 않은 경로 목록 (모든 스캔 엔드포인트 포함)
        public_paths = [
            '/api/',
            '/api/health',
            '/api/status',
            '/api/ping',
            '/api/auth/login',
            '/api/auth/register',
            '/api/auth/anonymous',
            '/api/openvpn/install-guide',
            '/api/scan/',  # 모든 스캔 엔드포인트 추가
            '/api/scan/quick',
            '/api/scan/full',
            '/api/scan/custom',
            '/api/scan/test'
        ]

        # OPTIONS 요청은 항상 허용 (CORS preflight)
        if request.method == 'OPTIONS':
            return

        # 특수 헤더 확인 - 인증 우회
        if (request.headers.get('X-Skip-Auth') == 'true' or 
            request.headers.get('X-Admin-Access') == 'true'):
            logger.info("특수 헤더로 인증 우회")
            g.user = {'id': 'admin', 'username': 'admin', 'role': 'admin'}
            return

        # 개발 환경에서는 인증 우회
        if app.config.get('DEVELOPMENT', False) or os.environ.get('FLASK_ENV') == 'development':
            logger.warning(f"개발 환경: 모든 요청 허용: {request.path}")
            g.user = {'id': 'dev_user', 'username': 'dev_user', 'role': 'admin'}
            return

        # 공개 경로는 인증 검사 패스
        if any(request.path.startswith(path) for path in public_paths):
            return

        # 모든 스캔 경로에 대해서는 경로가 /api/scan으로 시작하면 허용
        if request.path.startswith('/api/scan'):
            logger.info(f"스캔 경로 접근 허용: {request.path}")
            return

        # Authorization 헤더에서 토큰 추출
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized', 'message': '인증 토큰이 필요합니다.'}), 403

        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        
        if not payload:
            return jsonify({'error': 'Unauthorized', 'message': '유효하지 않은 토큰입니다.'}), 403
            
        # 인증 정보를 g 객체에 저장
        g.user = payload
        
    # 오류 핸들러 등록
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not Found', 'message': '요청한 리소스를 찾을 수 없습니다.'}), 404
        
    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"서버 내부 오류: {str(error)}")
        return jsonify({'error': 'Internal Server Error', 'message': '서버 내부 오류가 발생했습니다.'}), 500
        
    @app.errorhandler(Exception)
    def handle_exception(e):
        logger.error(f"처리되지 않은 예외: {str(e)}", exc_info=True)
        return jsonify({'error': 'Server Error', 'message': f'서버 오류: {str(e)}'}), 500
        
    return app

def setup_database(db):
    """데이터베이스 초기 설정 및 인덱스 생성"""
    try:
        # 컬렉션 존재 여부 확인
        collections = db.list_collection_names()
        
        # users 컬렉션 및 인덱스 설정
        if 'users' not in collections:
            logger.info("Creating users collection")
            db.create_collection('users')
        
        # 인덱스 정보 얻기
        user_indexes = db.users.index_information()
        
        # username 인덱스
        if 'username_1' not in user_indexes:
            db.users.create_index('username', unique=True)
            logger.info("Created unique index on users.username")
        
        # email 인덱스
        if 'email_1' not in user_indexes:
            db.users.create_index('email', unique=True, partialFilterExpression={'email': {'$exists': True}})
            logger.info("Created unique index on users.email")
            
        # anonymous_id 인덱스
        if 'anonymous_id_1' not in user_indexes:
            db.users.create_index('anonymous_id', unique=True, partialFilterExpression={'anonymous_id': {'$exists': True}})
            logger.info("Created unique index on users.anonymous_id")

    except Exception as e:
        logger.error(f"Error creating MongoDB indexes: {str(e)}")

# Utils for authentication
def generate_token(user):
    """사용자 정보로 JWT 토큰 생성"""
    return jwt.encode({
        'id': user.get('id', str(user.get('_id'))),
        'username': user['username'],
        'role': user.get('role', 'user'),
        'exp': datetime.utcnow() + timedelta(seconds=JWT_EXPIRATION)
    }, JWT_SECRET, algorithm='HS256')

def verify_token(token):
    """토큰 검증 및 디코딩"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return None

def hash_password(password):
    """비밀번호 해싱"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(password_hash, password):
    """비밀번호 확인"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash)

# 메모리 DB 관련 함수 삭제
def get_db():
    """현재 상황에 적합한 DB 반환"""
    return mongo.db
