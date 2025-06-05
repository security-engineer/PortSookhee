from flask import Blueprint, jsonify, request, current_app, g, send_file
import os
import subprocess
import logging
import tempfile
import shutil
import uuid
import hashlib
import platform  # 운영체제 확인을 위해 추가
import signal    # 프로세스 관리를 위해 추가
import psutil    # 프로세스 관리를 위해 추가 (새로운 의존성)
from datetime import datetime
import time as time_module
from werkzeug.utils import secure_filename
from bson.objectid import ObjectId

openvpn_bp = Blueprint('openvpn', __name__)
logger = logging.getLogger('app.openvpn')

# 운영체제 확인
IS_WINDOWS = platform.system() == 'Windows'
IS_MACOS = platform.system() == 'Darwin'
IS_LINUX = platform.system() == 'Linux'

# OpenVPN 영구 설정 파일 저장 디렉토리
OPENVPN_CONFIG_DIR = os.environ.get('OPENVPN_CONFIG_DIR', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads', 'openvpn'))

# 디렉토리가 없으면 생성
os.makedirs(OPENVPN_CONFIG_DIR, exist_ok=True)

# 현재 연결된 VPN 상태 저장 (임시 메모리 상태 - 실행 중인 연결용)
vpn_connections = {}
# 실행 중인 프로세스 별도 저장 (JSON 직렬화 문제 해결)
vpn_processes = {}

# 파일 업로드 진행 상태 추적
upload_status = {}

# 연결 상태 변경 추적을 위한 ETag 저장소
connection_etags = {}
connection_last_modified = {}

# OpenVPN 실행 파일 찾기
def find_openvpn_path():
    """운영체제에 맞게 OpenVPN 실행 파일 경로 찾기"""
    # 환경 변수로 지정된 경로 우선 확인
    env_path = os.environ.get('OPENVPN_PATH')
    if env_path and os.path.exists(env_path):
        logger.info(f"환경 변수에서 OpenVPN 경로 발견: {env_path}")
        return env_path
    
    if IS_WINDOWS:
        # Windows에서의 일반적인 OpenVPN 설치 경로들
        possible_paths = [
            r'C:\Program Files\OpenVPN\bin\openvpn.exe',
            r'C:\Program Files (x86)\OpenVPN\bin\openvpn.exe',
            os.environ.get('PROGRAMFILES', '') + r'\OpenVPN\bin\openvpn.exe',
            os.environ.get('PROGRAMFILES(X86)', '') + r'\OpenVPN\bin\openvpn.exe',
            # OpenVPN Connect (새로운 클라이언트)
            r'C:\Program Files\OpenVPN Connect\openvpn.exe',
            r'C:\Program Files (x86)\OpenVPN Connect\openvpn.exe',
            # 사용자 디렉토리 설치
            os.path.expanduser(r'~\AppData\Local\Programs\OpenVPN\bin\openvpn.exe'),
            os.path.expanduser(r'~\AppData\Local\Programs\OpenVPN Connect\openvpn.exe'),
            # Chocolatey 설치 경로
            r'C:\ProgramData\chocolatey\bin\openvpn.exe',
            # 기타 가능한 경로들
            r'D:\Program Files\OpenVPN\bin\openvpn.exe',
            r'D:\Program Files (x86)\OpenVPN\bin\openvpn.exe',
        ]
        for path in possible_paths:
            if path and os.path.exists(path):
                logger.info(f"OpenVPN 실행 파일 발견: {path}")
                return path
        
        # PATH 환경 변수에서 검색
        try:
            result = subprocess.run(['where', 'openvpn.exe'], 
                                  capture_output=True, 
                                  text=True, 
                                  timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                paths = result.stdout.strip().split('\n')
                for path in paths:
                    if os.path.exists(path):
                        logger.info(f"PATH에서 OpenVPN 발견: {path}")
                        return path
        except Exception as e:
            logger.debug(f"where 명령어 실행 실패: {str(e)}")
        
        # 레지스트리에서 OpenVPN 설치 경로 찾기 시도
        try:
            import winreg
            registry_paths = [
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\OpenVPN"),
                (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\OpenVPN"),
                (winreg.HKEY_CURRENT_USER, r"SOFTWARE\OpenVPN"),
            ]
            for hkey, subkey in registry_paths:
                try:
                    with winreg.OpenKey(hkey, subkey) as key:
                        install_path, _ = winreg.QueryValueEx(key, "")
                        openvpn_exe = os.path.join(install_path, "bin", "openvpn.exe")
                        if os.path.exists(openvpn_exe):
                            logger.info(f"레지스트리에서 OpenVPN 발견: {openvpn_exe}")
                            return openvpn_exe
                except:
                    continue
        except Exception as e:
            logger.debug(f"레지스트리 검색 실패: {str(e)}")
        
        logger.error("Windows에서 OpenVPN 실행 파일을 찾을 수 없습니다.")
        return None
    elif IS_MACOS:
        # macOS - Homebrew 설치 경로 확인
        possible_paths = [
            '/opt/homebrew/sbin/openvpn',
            '/usr/local/sbin/openvpn',
            '/usr/local/bin/openvpn',
            '/opt/homebrew/bin/openvpn'
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        try:
            return subprocess.check_output(['which', 'openvpn'], text=True).strip()
        except:
            return None
    else:  # Linux
        try:
            return subprocess.check_output(['which', 'openvpn'], text=True).strip()
        except:
            # 일반적인 Linux 설치 경로 확인
            possible_paths = [
                '/usr/sbin/openvpn',
                '/usr/bin/openvpn',
                '/sbin/openvpn'
            ]
            for path in possible_paths:
                if os.path.exists(path):
                    return path
            return None

# 프로세스 종료 함수
def kill_openvpn_process(process_id=None, connection_id=None):
    """플랫폼에 맞게 OpenVPN 프로세스 종료"""
    if process_id:
        try:
            if IS_WINDOWS:
                # Windows에서는 taskkill 사용
                subprocess.run(['taskkill', '/F', '/PID', str(process_id)], timeout=5, capture_output=True)
            else:
                # Unix 계열에서는 kill 사용
                os.kill(process_id, signal.SIGTERM)
                time_module.sleep(1)
                # 프로세스가 여전히 살아있는지 확인
                try:
                    os.kill(process_id, 0)
                    # 여전히 살아있으면 강제 종료
                    os.kill(process_id, signal.SIGKILL)
                except OSError:
                    pass  # 프로세스가 이미 종료됨
        except Exception as e:
            logger.error(f"프로세스 종료 오류 (PID {process_id}): {str(e)}")
    
    # connection_id로 관련 프로세스 검색 및 종료
    if connection_id:
        try:
            if IS_WINDOWS:
                # Windows에서는 psutil을 사용하여 수동으로 검색 및 종료
                for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                    try:
                        cmd_line = ' '.join(proc.info['cmdline'] or [])
                        if 'openvpn' in proc.info['name'].lower() and connection_id in cmd_line:
                            proc.terminate()
                            time_module.sleep(1)
                            if proc.is_running():
                                proc.kill()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            else:
                # Unix 계열에서는 pkill 명령어 사용
                subprocess.run(['pkill', '-f', f'openvpn.*{connection_id}'], timeout=5, capture_output=True)
        except Exception as e:
            logger.error(f"관련 프로세스 종료 오류 (Connection ID {connection_id}): {str(e)}")

# 앱 시작 시 openvpns 컬렉션 인덱스 생성 및 VPN 연결 정리
def setup_openvpn_indexes():
    """OpenVPN 컬렉션의 인덱스를 설정합니다."""
    try:
        # MongoDB 접근 방식 수정
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
            current_app.config['MONGO_DB'] = mongo_db
        
        # 인덱스 생성
        mongo_db.openvpns.create_index([('filename', 1)])
        mongo_db.openvpns.create_index([('user_id', 1)])
        mongo_db.openvpns.create_index([('created_at', -1)])
        
        logger.info("OpenVPN 컬렉션 인덱스 생성 완료")
        
        # 이전에 실행 중이던 모든 VPN 연결 상태 초기화
        mongo_db.openvpns.update_many(
            {"status": {"$in": ["connecting", "connected"]}},
            {"$set": {"status": "disconnected", "updated_at": datetime.now().isoformat()}}
        )
        logger.info("이전 VPN 연결 상태 초기화 완료")
        
    except Exception as e:
        logger.error(f"OpenVPN 인덱스 생성 오류: {str(e)}", exc_info=True)

# 앱 종료 시 VPN 프로세스 정리
def cleanup_vpn_processes():
    """실행 중인 모든 VPN 프로세스를 정리합니다."""
    try:
        # 모든 프로세스 종료
        for connection_id, process in vpn_processes.items():
            if process and process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=3)
                except:
                    try:
                        process.kill()
                    except:
                        pass
                    
        # 남은 프로세스 정리 (플랫폼에 맞게)
        if IS_WINDOWS:
            # Windows에서는 psutil을 사용하여 OpenVPN 프로세스 찾기
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    if 'openvpn' in proc.info['name'].lower():
                        proc.terminate()
                        time_module.sleep(1)
                        if proc.is_running():
                            proc.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        else:
            # Unix 계열에서는 pkill 사용
            try:
                subprocess.run(['sudo', 'pkill', '-f', 'openvpn'], timeout=5)
            except:
                try:
                    subprocess.run(['pkill', '-f', 'openvpn'], timeout=5)
                except:
                    pass
            
        logger.info("모든 VPN 프로세스 정리 완료")
    except Exception as e:
        logger.error(f"VPN 프로세스 정리 중 오류: {str(e)}")

@openvpn_bp.route('/status', methods=['GET'])
def get_vpn_status():
    """OpenVPN 연결 상태를 확인합니다."""
    connection_id = request.args.get('connection_id')
    user_id = request.args.get('user_id')
    
    try:
        # MongoDB 접근 방식 수정
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
            current_app.config['MONGO_DB'] = mongo_db
        
        # 특정 연결 ID가 제공된 경우
        if connection_id:
            # 데이터베이스에서 설정 찾기
            connection_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
            
            if not connection_doc:
                return jsonify({
                    'error': 'Not Found',
                    'message': '해당 ID의 VPN 설정을 찾을 수 없습니다.'
                }), 404
            
            # 실행 중인 상태가 있으면 그것도 포함
            if connection_id in vpn_connections:
                # process 객체 제외하고 복사 - JSON 직렬화 오류 방지
                connection_info = {k: v for k, v in vpn_connections[connection_id].items() if k != 'process'}
                
                # DB 정보와 통합 (DB 상태가 더 신뢰할 수 있음)
                connection_info.update({
                    'id': str(connection_doc['_id']),
                    'name': connection_doc['filename'],
                    'status': connection_doc.get('status', 'uploaded'),  # DB 상태 우선
                    'uploaded_at': connection_doc['created_at'],
                    'user_id': str(connection_doc['user_id']) if connection_doc.get('user_id') else None,
                    'description': connection_doc.get('description', '')
                })
                
                # 상태를 명확하게 표시 (프론트엔드 호환성)
                connection_info['status_text'] = {
                    'connected': '연결됨',
                    'connecting': '연결 중...',
                    'disconnected': '연결 해제됨',
                    'failed': '연결 실패',
                    'uploaded': '업로드됨',
                    'error': '오류 발생'
                }.get(connection_info['status'], connection_info['status'])
            else:
                connection_info = {
                    'id': str(connection_doc['_id']),
                    'name': connection_doc['filename'],
                    'status': connection_doc.get('status', 'uploaded'),
                    'status_text': {
                        'connected': '연결됨',
                        'connecting': '연결 중...',
                        'disconnected': '연결 해제됨',
                        'failed': '연결 실패',
                        'uploaded': '업로드됨',
                        'error': '오류 발생'
                    }.get(connection_doc.get('status', 'uploaded'), connection_doc.get('status', 'uploaded')),
                    'uploaded_at': connection_doc['created_at'],
                    'user_id': str(connection_doc['user_id']) if connection_doc.get('user_id') else None,
                    'description': connection_doc.get('description', '')
                }
                
            # ETag 및 상태 변경 감지
            
            # 상태 정보 해시 생성
            status_hash = hashlib.md5(
                f"{connection_info.get('status')}:{connection_info.get('connected_at', '')}:{connection_info.get('disconnected_at', '')}".encode()
            ).hexdigest()
            
            # 클라이언트 ETag 확인
            client_etag = request.headers.get('If-None-Match')
            last_etag = connection_etags.get(connection_id)
            
            # 상태 변경 감지
            status_changed = (last_etag != status_hash)
            
            # ETag 저장
            connection_etags[connection_id] = status_hash
            
            # 상태 시간 업데이트
            if connection_info.get('status') == 'disconnected' and connection_info.get('disconnected_at'):
                connection_last_modified[connection_id] = connection_info.get('disconnected_at')
            elif connection_info.get('status') == 'connected' and connection_info.get('connected_at'):
                connection_last_modified[connection_id] = connection_info.get('connected_at')
            
            # 상태에 따른 폴링 간격 추천
            if connection_info.get('status') == 'connected':
                poll_interval = 5000  # 연결됨: 5초
            elif connection_info.get('status') in ['disconnected', 'failed', 'error']:
                poll_interval = 30000  # 최종 상태: 30초
            else:
                poll_interval = 1000  # 연결 중: 1초
                
            # 폴링 간격 정보 추가
            connection_info['recommended_poll_interval'] = poll_interval
            
            # 응답 준비
            response = jsonify(connection_info)
            response.headers['ETag'] = f'"{status_hash}"'
            
            # ETag가 일치하면 304 응답 (Not Modified) - 모든 상태에 대해 적용
            if client_etag and client_etag == f'"{status_hash}"':
                # 디버깅 로그 없이 304 응답
                return '', 304
            
            # 상태에 따른 캐싱 전략 적용
            if connection_info.get('status') == 'connected':
                # 연결된 상태는 짧은 시간(5초) 캐싱 허용 - 폴링 부담 줄이기
                response.headers['Cache-Control'] = 'max-age=5, public'
                if connection_info.get('connected_at'):
                    response.headers['Last-Modified'] = connection_info['connected_at']
                
            elif connection_info.get('status') in ['disconnected', 'failed', 'error']:
                # 최종 상태는 더 긴 시간(30초) 캐싱 허용
                response.headers['Cache-Control'] = 'max-age=30, public'
                if connection_info.get('disconnected_at'):
                    response.headers['Last-Modified'] = connection_info['disconnected_at']
                    
            else:
                # 연결 중인 상태는 캐싱 없음 (실시간 업데이트)
                response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'
                
            return response
        
        # 사용자 ID로 필터링
        if user_id:
            # 관리자는 모든 설정 볼 수 있음
            if user_id == 'admin':
                configs = list(mongo_db.openvpns.find())
            else:
                # 문자열 ID를 ObjectId로 변환 (가능한 경우)
                try:
                    user_obj_id = ObjectId(user_id)
                    configs = list(mongo_db.openvpns.find({"user_id": user_obj_id}))
                except:
                    configs = list(mongo_db.openvpns.find({"user_id": user_id}))
                
            connections = []
            for config in configs:
                connection_info = {
                    'id': str(config['_id']),
                    'name': config['filename'],
                    'status': config.get('status', 'uploaded'),
                    'uploaded_at': config['created_at'],
                    'user_id': str(config['user_id']) if config.get('user_id') else None,
                    'description': config.get('description', '')
                }
                
                # 실행 중인 상태가 있으면 업데이트 (process 객체 제외)
                if str(config['_id']) in vpn_connections:
                    # process 필드를 제외한 모든 항목을 복사
                    for k, v in vpn_connections[str(config['_id'])].items():
                        if k != 'process':
                            connection_info[k] = v
                
                connections.append(connection_info)
                
            return jsonify({
                'connections': connections
            })
        
        # 모든 연결 상태 반환
        configs = list(mongo_db.openvpns.find())
        connections = []
        
        for config in configs:
            connection_info = {
                'id': str(config['_id']),
                'name': config['filename'],
                'status': config.get('status', 'uploaded'),
                'uploaded_at': config['created_at'],
                'user_id': str(config['user_id']) if config.get('user_id') else None,
                'description': config.get('description', '')
            }
            
            # 실행 중인 상태가 있으면 업데이트 (process 객체 제외)
            if str(config['_id']) in vpn_connections:
                # process 필드를 제외한 모든 항목을 복사
                for k, v in vpn_connections[str(config['_id'])].items():
                    if k != 'process':
                        connection_info[k] = v
            
            connections.append(connection_info)
            
        return jsonify({
            'connections': connections
        })
    
    except Exception as e:
        logger.error(f"VPN 상태 조회 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'VPN 상태 조회에 실패했습니다: {str(e)}'
        }), 500

@openvpn_bp.route('/upload', methods=['POST'])
def upload_config():
    """OpenVPN 설정 파일을 업로드합니다."""
    print("디버깅: upload_config 함수 호출됨")
    logger.info("디버깅: upload_config 함수 호출됨 (로거)")
    
    if 'file' not in request.files:
        print("디버깅: 'file'이 request.files에 없음")
        logger.error("디버깅: 'file'이 request.files에 없음 (로거)")
        return jsonify({
            'error': 'Bad Request',
            'message': 'OpenVPN 설정 파일이 제공되지 않았습니다.'
        }), 400
        
    file = request.files['file']
    print(f"디버깅: 파일 이름: {file.filename}")
    logger.info(f"디버깅: 파일 이름: {file.filename} (로거)")
    
    if file.filename == '':
        print("디버깅: 파일 이름이 비어 있음")
        logger.error("디버깅: 파일 이름이 비어 있음 (로거)")
        return jsonify({
            'error': 'Bad Request',
            'message': '파일이 선택되지 않았습니다.'
        }), 400
        
    if not file.filename.endswith('.ovpn'):
        print(f"디버깅: 파일 확장자가 .ovpn이 아님: {file.filename}")
        logger.error(f"디버깅: 파일 확장자가 .ovpn이 아님: {file.filename} (로거)")
        return jsonify({
            'error': 'Bad Request',
            'message': '.ovpn 파일만 업로드할 수 있습니다.'
        }), 400
    
    # 사용자 ID와 설명 가져오기
    user_id = request.form.get('user_id')
    description = request.form.get('description', '')
    
    print(f"디버깅: user_id: {user_id}, description: {description}")
    logger.info(f"디버깅: user_id: {user_id}, description: {description} (로거)")
    
    try:
        # 디렉토리 접근 가능한지 확인
        if not os.path.exists(OPENVPN_CONFIG_DIR):
            logger.error(f"OpenVPN 설정 디렉토리가 존재하지 않습니다: {OPENVPN_CONFIG_DIR}")
            os.makedirs(OPENVPN_CONFIG_DIR, exist_ok=True)
            logger.info(f"OpenVPN 설정 디렉토리를 생성했습니다: {OPENVPN_CONFIG_DIR}")
            
        # 디렉토리 쓰기 권한 확인
        if not os.access(OPENVPN_CONFIG_DIR, os.W_OK):
            logger.error(f"OpenVPN 설정 디렉토리에 쓰기 권한이 없습니다: {OPENVPN_CONFIG_DIR}")
            return jsonify({
                'error': 'Server Error',
                'message': 'OpenVPN 설정 디렉토리에 쓰기 권한이 없습니다.'
            }), 500
        
        # MongoDB 가져오기 - 수정된 방식
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
            current_app.config['MONGO_DB'] = mongo_db
        
        # MongoDB 연결 확인
        try:
            # MongoDB 연결 테스트
            mongo_db.command('ping')
            logger.info("MongoDB 연결 성공")
        except Exception as mongo_err:
            logger.error(f"MongoDB 연결 오류: {str(mongo_err)}")
            return jsonify({
                'error': 'Database Error',
                'message': f'MongoDB 연결에 실패했습니다: {str(mongo_err)}'
            }), 500
        
        # 사용자 ID를 ObjectId로 변환 (가능한 경우)
        user_obj_id = None
        if user_id and len(user_id) == 24:
            try:
                user_obj_id = ObjectId(user_id)
                # 사용자 존재 여부 확인
                user = mongo_db.users.find_one({"_id": user_obj_id})
                if not user:
                    logger.warning(f"사용자 ID에 해당하는 사용자를 찾을 수 없습니다: {user_id}")
                    user_obj_id = user_id  # 사용자가 없으면 문자열로 유지
            except Exception as user_err:
                logger.error(f"사용자 ID 변환 오류: {str(user_err)}")
                user_obj_id = user_id
        else:
            user_obj_id = user_id
            logger.info(f"사용자 ID 형식이 ObjectId가 아닙니다: {user_id}")
        
        # 안전한 파일명으로 변환
        filename = secure_filename(file.filename)
        
        # 고유 ID 생성
        connection_id = str(ObjectId())
        
        # 업로드 상태 추적 시작
        upload_status[connection_id] = {
            'status': 'uploading',
            'progress': 0,
            'filename': filename,
            'user_id': str(user_obj_id) if user_obj_id else None,
            'started_at': datetime.now().isoformat()
        }
        
        # 파일 저장 경로
        config_path = os.path.join(OPENVPN_CONFIG_DIR, f"{connection_id}_{filename}")
        logger.info(f"파일 저장 경로: {config_path}")
        
        # 파일 저장 시도
        try:
            file.save(config_path)
            if not os.path.exists(config_path):
                logger.error(f"파일이 저장되지 않았습니다: {config_path}")
                return jsonify({
                    'error': 'File System Error',
                    'message': '파일 저장에 실패했습니다: 파일이 생성되지 않음'
                }), 500
            logger.info(f"파일 저장 성공: {config_path}")
        except Exception as file_err:
            logger.error(f"파일 저장 오류: {str(file_err)}", exc_info=True)
            return jsonify({
                'error': 'File System Error',
                'message': f'파일 저장에 실패했습니다: {str(file_err)}'
            }), 500
        
        # 업로드 상태 업데이트
        upload_status[connection_id]['status'] = 'completed'
        upload_status[connection_id]['progress'] = 100
        upload_status[connection_id]['completed_at'] = datetime.now().isoformat()
        
        # 현재 시간
        now = datetime.now()
        
        # OpenVPN 설정 스키마
        openvpn_doc = {
            "_id": ObjectId(connection_id),
            "filename": filename,
            "config_path": config_path,
            "user_id": user_obj_id,  # ObjectId 또는 문자열
            "description": description,
            "status": "uploaded",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "last_connected": None,
            "last_disconnected": None,
            "connection_count": 0,
            "last_error": None,
            "metadata": {
                "file_size": os.path.getsize(config_path),
                "source": "user_upload",
                "client_ip": request.remote_addr
            }
        }
        
        # MongoDB openvpns 컬렉션에 저장 시도
        try:
            result = mongo_db.openvpns.insert_one(openvpn_doc)
            logger.info(f"MongoDB 문서 저장 성공: {result.inserted_id}")
        except Exception as db_err:
            logger.error(f"MongoDB 문서 저장 오류: {str(db_err)}", exc_info=True)
            # 파일은 저장되었지만 DB에 저장 실패한 경우, 파일 삭제 시도
            if os.path.exists(config_path):
                try:
                    os.remove(config_path)
                    logger.info(f"DB 오류로 인해 업로드된 파일 삭제: {config_path}")
                except:
                    logger.error(f"DB 오류 후 파일 삭제 실패: {config_path}")
            return jsonify({
                'error': 'Database Error',
                'message': f'데이터베이스 저장에 실패했습니다: {str(db_err)}'
            }), 500
        
        # 연결 정보 메모리에도 저장
        vpn_connections[connection_id] = {
            'id': connection_id,
            'name': filename,
            'status': 'uploaded',
            'uploaded_at': now.isoformat(),
            'config_path': config_path,
            'user_id': str(user_obj_id) if user_obj_id else None,
            'description': description,
            'last_error': None
        }
        
        logger.info(f"OpenVPN 설정 파일 업로드 완료: {filename} (ID: {connection_id}, 사용자: {user_id})")
        
        return jsonify({
            'message': 'OpenVPN 설정 파일이 업로드되었습니다.',
            'connection_id': connection_id,
            'name': filename,
            'status': 'completed',
            'user_id': str(user_obj_id) if user_obj_id else None
        })
        
    except Exception as e:
        logger.error(f"OpenVPN 설정 파일 업로드 오류 (상세): {str(e)}", exc_info=True)
        
        # 업로드 상태 업데이트 (실패)
        if 'connection_id' in locals():
            upload_status[connection_id] = {
                'status': 'failed',
                'error': str(e),
                'filename': filename if 'filename' in locals() else file.filename,
                'user_id': str(user_obj_id) if 'user_obj_id' in locals() and user_obj_id else None,
                'failed_at': datetime.now().isoformat()
            }
        
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'OpenVPN 설정 파일 업로드에 실패했습니다: {str(e)}'
        }), 500

@openvpn_bp.route('/connection/<connection_id>', methods=['DELETE'])
def delete_connection(connection_id):
    """OpenVPN 설정 파일을 삭제합니다."""
    try:
        # MongoDB 가져오기 - 수정된 방식
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
        
        # 데이터베이스에서 설정 찾기
        connection_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
        
        if not connection_doc:
            return jsonify({
                'error': 'Not Found',
                'message': '해당 ID의 VPN 설정을 찾을 수 없습니다.'
            }), 404
        
        # 파일 삭제
        config_path = connection_doc['config_path']
        if os.path.exists(config_path):
            os.remove(config_path)
            
        # 데이터베이스에서 삭제
        mongo_db.openvpns.delete_one({"_id": ObjectId(connection_id)})
        
        # 메모리에서도 삭제
        if connection_id in vpn_connections:
            del vpn_connections[connection_id]
            
        logger.info(f"OpenVPN 설정 파일 삭제 완료: (ID: {connection_id})")
        
        return jsonify({
            'message': 'OpenVPN 설정 파일이 삭제되었습니다.',
            'connection_id': connection_id
        })
        
    except Exception as e:
        logger.error(f"OpenVPN 설정 파일 삭제 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'OpenVPN 설정 파일 삭제에 실패했습니다: {str(e)}'
        }), 500

# OpenVPN 설정 파일 검증 함수 개선
def validate_ovpn_file(file_path):
    """OpenVPN 설정 파일의 유효성을 검사합니다."""
    try:
        # 파일 존재 확인
        if not os.path.exists(file_path):
            print(f"디버깅: 파일이 존재하지 않음: {file_path}")
            return False, "설정 파일이 존재하지 않습니다."

        # 파일 내용 확인
        try:
            with open(file_path, 'rb') as f:
                binary_content = f.read()
                
            # 기본 검증
            if b'remote ' not in binary_content:
                return False, "VPN 서버 정보(remote)가 누락되었습니다."
                
            # ovpn 파일 백업
            backup_path = f"{file_path}.bak"
            with open(backup_path, 'wb') as f:
                f.write(binary_content)
                
            print(f"디버깅: 원본 파일 백업 완료: {backup_path}")
            
            # 파일 내용만 간단히 확인하고 원본 그대로 사용
            return True, "OpenVPN 설정 파일이 검증되었습니다."
            
        except Exception as file_err:
            print(f"디버깅: 파일 처리 오류: {str(file_err)}")
            return False, f"설정 파일 처리 오류: {str(file_err)}"
            
    except Exception as e:
        print(f"디버깅: 파일 검증 중 예외 발생: {str(e)}")
        return False, f"파일 검증 중 오류 발생: {str(e)}"

@openvpn_bp.route('/connect', methods=['POST']) # OpenVPN 연결 문제 수정
def connect_vpn():
    """업로드된 OpenVPN 설정 파일로 연결을 시작합니다."""
    print("디버깅: connect_vpn 함수 호출됨")
    logger.info("디버깅: connect_vpn 함수 호출됨")
    
    data = request.get_json()
    
    if not data or 'connection_id' not in data:
        print("디버깅: 연결 ID가 요청에 없음")
        return jsonify({
            'error': 'Bad Request',
            'message': '연결 ID가 필요합니다.'
        }), 400
        
    connection_id = data['connection_id']
    print(f"디버깅: 연결 ID: {connection_id}")
    
    try:
        # MongoDB 접근
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
        
        connection_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
        
        if not connection_doc:
            print(f"디버깅: 연결 ID {connection_id}에 해당하는 VPN 설정을 찾을 수 없음")
            return jsonify({
                'error': 'Not Found',
                'message': '해당 ID의 VPN 설정을 찾을 수 없습니다.'
            }), 404
        
        # 메모리 상태 업데이트
        if connection_id not in vpn_connections:
            vpn_connections[connection_id] = {
                'id': connection_id,
                'name': connection_doc['filename'],
                'status': 'uploaded',
                'uploaded_at': connection_doc['created_at'],
                'config_path': connection_doc['config_path'],
                'user_id': str(connection_doc['user_id']) if connection_doc.get('user_id') else None,
                'description': connection_doc.get('description', ''),
                'last_error': None
            }
        
        connection = vpn_connections[connection_id]
        config_path = connection_doc['config_path']
        
        print(f"디버깅: VPN 설정 파일 경로: {config_path}")
        
        # 실행 중인 프로세스가 있으면 종료
        if connection_id in vpn_processes and vpn_processes[connection_id] and vpn_processes[connection_id].poll() is None:
            print(f"디버깅: 실행 중인 프로세스 종료 (PID: {vpn_processes[connection_id].pid})")
            try:
                vpn_processes[connection_id].terminate()
                time_module.sleep(1)
            except:
                pass
                
        # 기존 프로세스 정리 (플랫폼에 맞게)
        kill_openvpn_process(connection_id=connection_id)
        
        # 설정 파일 검증
        is_valid, validation_msg = validate_ovpn_file(config_path)
        if not is_valid:
            print(f"디버깅: 설정 파일 검증 실패: {validation_msg}")
            
            # 상태 업데이트
            connection['status'] = 'failed'
            connection['last_error'] = validation_msg
            
            # MongoDB 상태 업데이트
            mongo_db.openvpns.update_one(
                {"_id": ObjectId(connection_id)},
                {"$set": {
                    "status": "failed",
                    "last_error": validation_msg,
                    "updated_at": datetime.now().isoformat()
                }}
            )
            
            return jsonify({
                'error': 'Invalid Configuration',
                'message': validation_msg,
                'status': 'failed'
            }), 400
            
        print(f"디버깅: 설정 파일 검증 성공: {validation_msg}")
        
        # 플랫폼에 맞게 OpenVPN 경로 찾기
        openvpn_path = find_openvpn_path()
            
        if not openvpn_path or not os.path.exists(openvpn_path):
            error_msg = f"OpenVPN 실행 파일을 찾을 수 없습니다. 설치 여부를 확인하세요."
            logger.error(error_msg)
            return jsonify({
                'error': 'Configuration Error',
                'message': error_msg,
                'status': 'failed'
            }), 500
            
        # 로그 파일 경로
        logs_dir = os.path.join(OPENVPN_CONFIG_DIR, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        log_file_path = os.path.join(logs_dir, f"openvpn_{connection_id}.log")
        
        # Windows에서는 경로에 공백이 있을 경우 따옴표로 감싸기
        if IS_WINDOWS and (' ' in config_path or ' ' in log_file_path):
            config_path = f'"{config_path}"'
            log_file_path = f'"{log_file_path}"'
        
        # OpenVPN 명령
        cmd = [openvpn_path, '--config', config_path, '--log', log_file_path]
        
        print(f"디버깅: OpenVPN 명령: {' '.join(cmd)}")
        
        # OpenVPN 프로세스 시작
        try:
            # Windows에서는 관리자 권한이 필요할 수 있음
            if IS_WINDOWS:
                # startupinfo 객체를 생성하여 창 숨김 설정
                import subprocess
                startupinfo = None
                if hasattr(subprocess, 'STARTUPINFO'):
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                    startupinfo.wShowWindow = 0  # 창 숨김
                
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    creationflags=subprocess.CREATE_NO_WINDOW,  # 콘솔 창 숨기기
                    startupinfo=startupinfo
                )
            else:
                # Unix 계열에서는 일반 시작
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
            
            # 현재 시간
            now = datetime.now()
            
            # 상태 업데이트
            connection['status'] = 'connecting'
            connection['started_at'] = now.isoformat()
            connection['log_file'] = log_file_path
            vpn_processes[connection_id] = process
            
            print(f"디버깅: OpenVPN 프로세스 시작 (PID: {process.pid})")
            
            # MongoDB 상태 업데이트
            mongo_db.openvpns.update_one(
                {"_id": ObjectId(connection_id)},
                {"$set": {
                    "status": "connecting",
                    "updated_at": now.isoformat()
                }}
            )
            
            # 비동기 모니터링 스레드
            def monitor_process():
                try:
                    # 2초 대기 후 프로세스 상태 확인
                    time_module.sleep(2)
                    
                    # 프로세스가 아직 실행 중인지 확인
                    if process.poll() is None:
                        # 현재 시간
                        now = datetime.now().isoformat()
                        
                        # 아직 실행 중이면 연결 성공으로 간주
                        connection['status'] = 'connected'
                        connection['connected_at'] = now
                        
                        # ETag 갱신 (상태 변경)
                        connection_etags[connection_id] = hashlib.md5(
                            f"connected:{now}:".encode()
                        ).hexdigest()
                        connection_last_modified[connection_id] = now
                        
                        # MongoDB 상태 업데이트
                        update_result = mongo_db.openvpns.update_one(
                            {"_id": ObjectId(connection_id)},
                            {"$set": {
                                "status": "connected",
                                "connected_at": now,
                                "updated_at": now,
                                "connection_count": connection_doc.get('connection_count', 0) + 1
                            }}
                        )
                        
                        print(f"디버깅: OpenVPN 연결 성공 (DB 업데이트: {update_result.modified_count})")
                        logger.info(f"OpenVPN 연결 성공 (ID: {connection_id})")
                        
                        # 메모리 상태 로깅 - 디버깅 확인용
                        print(f"디버깅: 현재 메모리 연결 상태: {connection}")
                        
                        # 업데이트 후 DB에서 다시 읽어서 확인
                        updated_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
                        if updated_doc:
                            print(f"디버깅: DB 저장 후 상태: {updated_doc.get('status')}")
                        else:
                            print("디버깅: DB에서 업데이트된 문서를 찾을 수 없음")
                    else:
                        # 프로세스가 종료됨 - 오류
                        return_code = process.returncode
                        
                        # 로그 파일 확인
                        error_msg = "알 수 없는 오류"
                        try:
                            # 로그 파일 확인
                            if os.path.exists(log_file_path):
                                with open(log_file_path, 'r') as f:
                                    log_content = f.read()
                                    if log_content:
                                        # 전체 로그 출력 (디버깅용)
                                        print(f"디버깅: OpenVPN 로그 내용:\n{log_content}")
                                        logger.error(f"OpenVPN 오류 로그:\n{log_content}")
                                        
                                        # 오류 메시지 추출 (마지막 500자 또는 오류 포함 라인)
                                        if "error" in log_content.lower():
                                            # 오류 관련 라인 찾기
                                            error_lines = [line for line in log_content.splitlines() 
                                                         if "error" in line.lower() or 
                                                            "warning" in line.lower() or 
                                                            "critical" in line.lower() or
                                                            "fatal" in line.lower()]
                                            if error_lines:
                                                error_msg = "\n".join(error_lines[-3:])  # 마지막 3개 오류 메시지
                                            else:
                                                error_msg = log_content[-500:] if len(log_content) > 500 else log_content
                                        else:
                                            error_msg = log_content[-500:] if len(log_content) > 500 else log_content
                            
                            # stdout/stderr 확인
                            stdout_data, stderr_data = process.communicate(timeout=0.1)
                            if stdout_data:
                                print(f"디버깅: OpenVPN stdout: {stdout_data}")
                                logger.info(f"OpenVPN stdout: {stdout_data}")
                            if stderr_data:
                                print(f"디버깅: OpenVPN stderr: {stderr_data}")
                                logger.error(f"OpenVPN stderr: {stderr_data}")
                                if not error_msg or error_msg == "알 수 없는 오류":
                                    error_msg = stderr_data
                        except Exception as log_err:
                            print(f"디버깅: 로그 파일 읽기 오류: {str(log_err)}")
                            logger.error(f"로그 파일 읽기 오류: {str(log_err)}")
                            
                        # 상태 업데이트
                        connection['status'] = 'failed'
                        connection['last_error'] = error_msg
                        
                        # 실패 시 ETag 갱신
                        now = datetime.now().isoformat()
                        connection_etags[connection_id] = hashlib.md5(
                            f"failed::{now}".encode()
                        ).hexdigest()
                        connection_last_modified[connection_id] = now
                        
                        # MongoDB 상태 업데이트
                        mongo_db.openvpns.update_one(
                            {"_id": ObjectId(connection_id)},
                            {"$set": {
                                "status": "failed",
                                "last_error": error_msg,
                                "updated_at": datetime.now().isoformat()
                            }}
                        )
                        
                        print(f"디버깅: OpenVPN 연결 실패 (오류 코드: {return_code})")
                        logger.error(f"OpenVPN 연결 실패 (ID: {connection_id}): {error_msg}")
                        
                        # 실패한 로그는 보존
                except Exception as e:
                    print(f"디버깅: 모니터링 오류: {str(e)}")
                    
            # 모니터링 스레드 시작
            import threading
            monitor_thread = threading.Thread(target=monitor_process)
            monitor_thread.daemon = True
            monitor_thread.start()
            
            # 연결 시작 응답
            return jsonify({
                'message': 'OpenVPN 연결이 시작되었습니다.',
                'connection_id': connection_id,
                'status': 'connecting'
            })
            
        except Exception as e:
            error_msg = f"OpenVPN 프로세스 시작 실패: {str(e)}"
            print(f"디버깅: {error_msg}")
            
            # 상태 업데이트
            connection['status'] = 'failed'
            connection['last_error'] = error_msg
            
            # 로그 파일은 보존
                
            # MongoDB 상태 업데이트
            mongo_db.openvpns.update_one(
                {"_id": ObjectId(connection_id)},
                {"$set": {
                    "status": "failed",
                    "last_error": error_msg,
                    "updated_at": datetime.now().isoformat()
                }}
            )
            
            return jsonify({
                'error': 'Process Error',
                'message': error_msg,
                'status': 'failed'
            }), 500
            
    except Exception as e: # TODO: 현재 오류 발생 지점.
        error_msg = f"OpenVPN 연결 중 오류: {str(e)}"
        print(f"디버깅: {error_msg}")
        logger.error(error_msg, exc_info=True)
        
        return jsonify({
            'error': 'Server Error',
            'message': error_msg,
            'status': 'error'
        }), 500

@openvpn_bp.route('/disconnect', methods=['POST'])
def disconnect_vpn():
    """OpenVPN 연결을 종료합니다."""
    print("디버깅: disconnect_vpn 함수 호출됨")
    logger.info("디버깅: disconnect_vpn 함수 호출됨")
    
    data = request.get_json()
    print(f"디버깅: 요청 데이터: {data}")
    
    if not data or 'connection_id' not in data:
        print("디버깅: connection_id가 요청에 없음")
        return jsonify({
            'error': 'Bad Request',
            'message': '연결 ID가 필요합니다.'
        }), 400
        
    connection_id = data['connection_id']
    print(f"디버깅: 연결 ID: {connection_id}")
    
    try:
        # MongoDB에서 설정 가져오기 - 수정된 방식
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
            print("디버깅: MONGO_DB 사용")
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
            print("디버깅: MONGO.db 사용")
        else:
            print("디버깅: PyMongo 다시 초기화")
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
            
        print(f"디버깅: MongoDB 접근 성공")
        
        # 데이터베이스에서 설정 찾기
        connection_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
        
        if not connection_doc:
            print(f"디버깅: 연결 ID {connection_id}에 해당하는 문서를 DB에서 찾을 수 없음")
            return jsonify({
                'error': 'Not Found',
                'message': '해당 ID의 VPN 설정을 찾을 수 없습니다.'
            }), 404
            
        # 수정된 부분: 메모리에 없더라도 계속 진행
        # 메모리에 설정 정보가 없으면 생성해서 진행
        if connection_id not in vpn_connections:
            print(f"디버깅: 연결 ID {connection_id}가 메모리에 없음, 새로 생성")
            vpn_connections[connection_id] = {
                'id': connection_id,
                'name': connection_doc['filename'],
                'status': connection_doc.get('status', 'disconnected'),  # 기본값을 disconnected로 설정
                'uploaded_at': connection_doc.get('created_at'),
                'config_path': connection_doc.get('config_path'),
                'user_id': str(connection_doc['user_id']) if connection_doc.get('user_id') else None,
                'description': connection_doc.get('description', ''),
                'last_error': None
            }
        
        connection = vpn_connections[connection_id]
        print(f"디버깅: 현재 연결 상태: {connection.get('status', 'unknown')}")
        
        # 이미 연결 해제된 상태라면 바로 성공 응답
        if connection.get('status') == 'disconnected':
            print(f"디버깅: 이미 연결 해제된 상태")
            return jsonify({
                'message': 'OpenVPN 연결이 이미 종료되었습니다.',
                'connection_id': connection_id,
                'status': 'disconnected'
            })
        
        # OpenVPN 프로세스 종료
        process_terminated = False
        if connection_id in vpn_processes and vpn_processes[connection_id] is not None:
            print(f"디버깅: 프로세스 종료 시도")
            try:
                # 먼저 정상 종료 시도
                vpn_processes[connection_id].terminate()
                
                # 5초 대기 후 여전히 실행 중이면 강제 종료
                try:
                    vpn_processes[connection_id].wait(timeout=5)
                    process_terminated = True
                    print(f"디버깅: 프로세스 정상 종료됨")
                except subprocess.TimeoutExpired:
                    vpn_processes[connection_id].kill()
                    process_terminated = True
                    print(f"디버깅: 프로세스 강제 종료됨")
                    
                # 종료 후 프로세스 객체 삭제
                del vpn_processes[connection_id]
            except Exception as e:
                print(f"디버깅: 프로세스 종료 오류: {str(e)}")
                logger.error(f"프로세스 종료 오류: {str(e)}")
        else:
            print(f"디버깅: 실행 중인 프로세스가 없음")
        
        # 플랫폼에 맞게 OpenVPN 프로세스 정리
        print(f"디버깅: 플랫폼에 맞는 방식으로 프로세스 정리")
        try:
            kill_openvpn_process(connection_id=connection_id)
            print(f"디버깅: 프로세스 정리 완료")
        except Exception as kill_err:
            print(f"디버깅: 프로세스 정리 오류: {str(kill_err)}")
            logger.error(f"프로세스 정리 오류: {str(kill_err)}")
        
        # 현재 시간
        now = datetime.now()
        
        # 메모리 상태 업데이트
        connection['status'] = 'disconnected'
        connection['disconnected_at'] = now.isoformat()
        
        # ETag 갱신 (상태 변경)
        connection_etags[connection_id] = hashlib.md5(
            f"disconnected::{now.isoformat()}".encode()
        ).hexdigest()
        connection_last_modified[connection_id] = now.isoformat()
        
        # MongoDB 상태 업데이트
        print(f"디버깅: MongoDB 상태 업데이트 시도")
        update_result = mongo_db.openvpns.update_one(
            {"_id": ObjectId(connection_id)},
            {"$set": {
                "status": "disconnected",
                "last_disconnected": now.isoformat(),
                "updated_at": now.isoformat()
            }}
        )
        print(f"디버깅: MongoDB 업데이트 결과: {update_result.modified_count} 문서 수정됨")
        
        logger.info(f"OpenVPN 연결 종료 (ID: {connection_id})")
        
        return jsonify({
            'message': 'OpenVPN 연결이 종료되었습니다.',
            'connection_id': connection_id,
            'status': 'disconnected'
        })
        
    except Exception as e:
        print(f"디버깅: 연결 종료 처리 중 예외 발생: {str(e)}")
        logger.error(f"OpenVPN 연결 종료 중 오류: {str(e)}", exc_info=True)
        
        # 메모리 상태 업데이트
        if connection_id in vpn_connections:
            vpn_connections[connection_id]['status'] = 'error'
            vpn_connections[connection_id]['last_error'] = str(e)
        
        # MongoDB 상태 업데이트
        try:
            mongo_db.openvpns.update_one(
                {"_id": ObjectId(connection_id)},
                {"$set": {
                    "status": "failed",
                    "updated_at": datetime.now().isoformat(),
                    "last_error": str(e)
                }}
            )
        except Exception as db_err:
            print(f"디버깅: MongoDB 업데이트 오류: {str(db_err)}")
            pass
        
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'OpenVPN 연결 종료에 실패했습니다: {str(e)}'
        }), 500

@openvpn_bp.route('/check-openvpn', methods=['GET'])
def check_openvpn():
    """OpenVPN 설치 여부를 확인합니다."""
    try:
        openvpn_path = find_openvpn_path()
        
        if not openvpn_path:
            return jsonify({
                'installed': False,
                'message': 'OpenVPN이 설치되어 있지 않습니다.'
            })
            
        # 버전 정보 확인
        try:
            version_output = subprocess.check_output([openvpn_path, '--version'], 
                                                     stderr=subprocess.STDOUT, 
                                                     text=True, 
                                                     timeout=5)
            
            version = "알 수 없음"
            for line in version_output.splitlines():
                if "OpenVPN" in line:
                    version = line.strip()
                    break
                    
            return jsonify({
                'installed': True,
                'path': openvpn_path,
                'version': version,
                'is_windows': IS_WINDOWS,
                'is_macos': IS_MACOS,
                'is_linux': IS_LINUX
            })
            
        except Exception as e:
            return jsonify({
                'installed': True,
                'path': openvpn_path,
                'version': '확인 불가',
                'message': f'버전 확인 중 오류: {str(e)}'
            })
            
    except Exception as e:
        return jsonify({
            'installed': False,
            'error': str(e),
            'message': 'OpenVPN 확인 중 오류가 발생했습니다.'
        }), 500

@openvpn_bp.route('/install-guide', methods=['GET'])
def openvpn_install_guide():
    """OpenVPN 설치 가이드를 제공합니다."""
    os_type = request.args.get('os', 'unknown').lower()
    
    guides = {
        'macos': {
            'title': 'macOS에 OpenVPN 설치 가이드',
            'steps': [
                'Homebrew를 사용하는 경우: `brew install openvpn`',
                'Tunnelblick 클라이언트를 설치하는 경우: https://tunnelblick.net/downloads.html 에서 다운로드하여 설치',
                '설치 후 시스템을 재시작하거나 터미널에서 `which openvpn`으로 설치 확인'
            ]
        },
        'windows': {
            'title': 'Windows에 OpenVPN 설치 가이드',
            'steps': [
                'OpenVPN 공식 웹사이트(https://openvpn.net/community-downloads/)에서 설치 파일 다운로드',
                '다운로드한 설치 파일 실행 및 설치 마법사 따라 설치',
                '설치 시 모든 구성 요소 설치(TAP 가상 어댑터 포함)',
                '설치 후 컴퓨터 재시작'
            ]
        },
        'linux': {
            'title': 'Linux에 OpenVPN 설치 가이드',
            'steps': [
                'Ubuntu/Debian: `sudo apt update && sudo apt install openvpn`',
                'CentOS/RHEL: `sudo yum install epel-release && sudo yum install openvpn`',
                'Arch Linux: `sudo pacman -S openvpn`',
                '설치 후 `which openvpn`으로 설치 확인'
            ]
        }
    }
    
    return jsonify(guides.get(os_type, {
        'title': 'OpenVPN 설치 가이드',
        'steps': [
            'OpenVPN 공식 웹사이트(https://openvpn.net/)에서 귀하의 운영 체제에 맞는 설치 파일 다운로드',
            '다운로드한 설치 파일을 실행하여 설치 마법사를 따라 설치',
            '설치 후 시스템을 재시작'
        ]
    }))

# 업로드 상태 확인 API 추가
@openvpn_bp.route('/upload-status/<connection_id>', methods=['GET'])
def get_upload_status(connection_id):
    """특정 파일의 업로드 상태를 확인합니다."""
    try:
        # 업로드 상태가 메모리에 있는 경우
        if connection_id in upload_status:
            return jsonify(upload_status[connection_id])
            
        # 메모리에 없는 경우 데이터베이스에서 조회
        # MongoDB 접근 방식 수정
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
        
        connection_doc = mongo_db.openvpns.find_one({"_id": ObjectId(connection_id)})
        
        if connection_doc:
            return jsonify({
                'status': 'completed',
                'progress': 100,
                'filename': connection_doc['filename'],
                'user_id': str(connection_doc['user_id']) if connection_doc.get('user_id') else None,
                'uploaded_at': connection_doc['created_at']
            })
        
        # 찾을 수 없는 경우
        return jsonify({
            'error': 'Not Found',
            'message': '해당 ID의 업로드 정보를 찾을 수 없습니다.'
        }), 404
            
    except Exception as e:
        logger.error(f"업로드 상태 조회 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'업로드 상태 조회에 실패했습니다: {str(e)}'
        }), 500

# 사용자별 업로드 파일 목록 조회 API 추가
@openvpn_bp.route('/user-uploads/<user_id>', methods=['GET'])
def get_user_uploads(user_id):
    """특정 사용자의 업로드 파일 목록을 조회합니다."""
    try:
        # MongoDB 접근 방식 수정
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
        
        # 사용자 ID를 ObjectId로 변환 (가능한 경우)
        try:
            user_obj_id = ObjectId(user_id)
            # 사용자 존재 여부 확인
            user = mongo_db.users.find_one({"_id": user_obj_id})
            if not user:
                return jsonify({
                    'error': 'Not Found',
                    'message': '해당 ID의 사용자를 찾을 수 없습니다.'
                }), 404
                
        except:
            user_obj_id = user_id
        
        # 사용자의 OpenVPN 설정 파일 목록 조회
        uploads = list(mongo_db.openvpns.find({"user_id": user_obj_id}))
        
        # ObjectId를 문자열로 변환하여 JSON 직렬화 가능하게 만듦
        for upload in uploads:
            upload['_id'] = str(upload['_id'])
            if isinstance(upload.get('user_id'), ObjectId):
                upload['user_id'] = str(upload['user_id'])
        
        return jsonify({
            'user_id': user_id,
            'upload_count': len(uploads),
            'uploads': uploads
        })
            
    except Exception as e:
        logger.error(f"사용자 업로드 목록 조회 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'사용자 업로드 목록 조회에 실패했습니다: {str(e)}'
        }), 500

# 대시보드용 사용자별 OpenVPN 통계 API 추가
@openvpn_bp.route('/user-stats/<user_id>', methods=['GET'])
def get_user_openvpn_stats(user_id):
    """사용자의 OpenVPN 사용 통계를 제공합니다."""
    try:
        # MongoDB 접근 방식 수정
        if 'MONGO_DB' in current_app.config:
            mongo_db = current_app.config['MONGO_DB']
        elif 'MONGO' in current_app.config:
            mongo_db = current_app.config['MONGO'].db
        else:
            from flask_pymongo import PyMongo
            mongo = PyMongo(current_app)
            mongo_db = mongo.db
        
        # 사용자 ID를 ObjectId로 변환 (가능한 경우)
        try:
            user_obj_id = ObjectId(user_id)
            # 사용자 존재 여부 확인
            user = mongo_db.users.find_one({"_id": user_obj_id})
            if not user:
                return jsonify({
                    'error': 'Not Found',
                    'message': '해당 ID의 사용자를 찾을 수 없습니다.'
                }), 404
                
        except:
            user_obj_id = user_id
        
        # 사용자의 OpenVPN 설정 파일 목록 조회
        uploads = list(mongo_db.openvpns.find({"user_id": user_obj_id}))
        
        # 통계 계산
        total_configs = len(uploads)
        active_configs = sum(1 for upload in uploads if upload.get('status') in ['connected', 'connecting'])
        failed_configs = sum(1 for upload in uploads if upload.get('status') in ['failed', 'error'])
        total_connections = sum(upload.get('connection_count', 0) for upload in uploads)
        
        # 최근 연결 정보
        recent_connections = list(mongo_db.openvpns.find(
            {"user_id": user_obj_id, "last_connected": {"$ne": None}}
        ).sort("last_connected", -1).limit(5))
        
        # ObjectId를 문자열로 변환
        for conn in recent_connections:
            conn['_id'] = str(conn['_id'])
            if isinstance(conn.get('user_id'), ObjectId):
                conn['user_id'] = str(conn['user_id'])
        
        return jsonify({
            'user_id': user_id,
            'total_configs': total_configs,
            'active_configs': active_configs,
            'failed_configs': failed_configs,
            'total_connections': total_connections,
            'recent_connections': recent_connections
        })
            
    except Exception as e:
        logger.error(f"사용자 OpenVPN 통계 조회 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'사용자 OpenVPN 통계 조회에 실패했습니다: {str(e)}'
        }), 500

# 앱 시작 시 인덱스 생성 함수 등록하기 위한 코드 추가
def register_openvpn_handlers(app):
    """앱에 OpenVPN 관련 핸들러를 등록합니다."""
    with app.app_context():
        setup_openvpn_indexes()
        
    # 앱 종료 시 VPN 프로세스 정리 등록
    import atexit
    atexit.register(cleanup_vpn_processes) 