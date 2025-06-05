from flask import Blueprint, jsonify, request, g, current_app
import logging
import uuid
import traceback
from ..scan import (
    ScanMode, ScanStatus, is_valid_target,
    start_scan_task, get_scan_status, check_nmap_installed,
    NMAP_AVAILABLE, test_scan, generate_test_data, scan_results
)
from bson.objectid import ObjectId
from bson.json_util import dumps, loads

scan_bp = Blueprint('scan', __name__)
logger = logging.getLogger('app.scan')

# 디버그 모드 설정
DEBUG_MODE = True

# 스캔 작업 시작 API
@scan_bp.route('/', methods=['POST', 'OPTIONS'])
def start_scan():
    """스캔 작업을 시작하는 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        # CORS 헤더 추가
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
    
    try:
        # 요청 로깅
        logger.info(f"스캔 요청 받음: {request.method} {request.path}")
        logger.info(f"요청 헤더: {dict(request.headers)}")
        
        # JSON 요청 검증
        if not request.is_json:
            logger.warning("JSON 형식이 아닌 요청 거부")
            return jsonify({
                'error': 'Bad Request',
                'message': 'JSON 형식의 요청이 필요합니다.'
            }), 400
            
        data = request.get_json()
        logger.info(f"요청 데이터: {data}")
        
        # 필수 파라미터 검증
        if not data or 'target' not in data or 'mode' not in data:
            return jsonify({
                'error': 'Bad Request',
                'message': '대상(target)과 모드(mode)는 필수 항목입니다.'
            }), 400
            
        target = data['target']
        mode = data['mode']
        
        # 대상 검증
        if not is_valid_target(target):
            return jsonify({
                'error': 'Bad Request',
                'message': f'잘못된 대상 형식: {target}'
            }), 400
            
        # 스캔 모드 검증
        if mode not in [ScanMode.QUICK, ScanMode.FULL, ScanMode.CUSTOM, ScanMode.TEST]:
            return jsonify({
                'error': 'Bad Request',
                'message': f'지원하지 않는 스캔 모드: {mode}. 지원되는 모드: quick, full, custom, test'
            }), 400
            
        # nmap 설치 확인 (테스트 모드는 제외)
        if mode != ScanMode.TEST and not check_nmap_installed():
            logger.warning(f"nmap이 설치되어 있지 않아 테스트 모드로 변경합니다: {target}")
            mode = ScanMode.TEST
            # 경고 메시지는 반환하되 오류는 반환하지 않음
            # 계속 진행하고 테스트 모드로 스캔 실행
            
        # 고유 스캔 ID 생성
        scan_id = str(uuid.uuid4())
        logger.info(f"생성된 스캔 ID: {scan_id}")
        
        # 스캔 설정
        kwargs = {}
        if mode == ScanMode.CUSTOM:
            # 사용자 정의 스캔의 경우 ports나 arguments가 필요함
            if 'ports' not in data and 'arguments' not in data:
                return jsonify({
                    'error': 'Bad Request',
                    'message': '사용자 정의 스캔에는 ports 또는 arguments가 필요합니다.'
                }), 400
            
            # 선택적 파라미터
            if 'ports' in data:
                kwargs['ports'] = data['ports']
            if 'arguments' in data:
                kwargs['arguments'] = data['arguments']
        
        # MongoDB에 스캔 기록 저장 (optional)
        if hasattr(g, 'mongodb_available') and g.mongodb_available:
            try:
                db = current_app.extensions['pymongo'].db
                scan_record = {
                    '_id': scan_id,
                    'target': target,
                    'mode': mode,
                    'status': ScanStatus.PENDING,
                    'created_at': ObjectId().generation_time,
                    'options': kwargs
                }
                db.scans.insert_one(scan_record)
                logger.info(f"MongoDB에 스캔 기록 저장 성공: {scan_id}")
            except Exception as e:
                logger.error(f"MongoDB 기록 오류 (무시됨): {str(e)}")
                # MongoDB 오류는 무시하고 계속 진행
        
        # 스캔 작업 시작
        try:
            result = start_scan_task(scan_id, mode, target, **kwargs)
            logger.info(f"스캔 작업 시작 성공: {scan_id}")
            
            response_data = {
                'message': '스캔 작업이 시작되었습니다.',
                'scan_id': scan_id,
                'target': target,
                'mode': mode,
                'status': ScanStatus.PENDING
            }
            
            # nmap 없이 테스트 모드로 자동 변경된 경우 경고 메시지 추가
            if mode == ScanMode.TEST and not NMAP_AVAILABLE:
                response_data['warning'] = 'nmap이 설치되어 있지 않아 테스트 모드로 실행됩니다.'
            
            return jsonify(response_data)
        except Exception as e:
            logger.error(f"스캔 작업 시작 실패: {str(e)}")
            # MongoDB에 실패 상태 업데이트
            if hasattr(g, 'mongodb_available') and g.mongodb_available:
                try:
                    db = current_app.extensions['pymongo'].db
                    db.scans.update_one(
                        {'_id': scan_id},
                        {'$set': {'status': ScanStatus.FAILED, 'error': str(e)}}
                    )
                except Exception:
                    pass  # MongoDB 업데이트 오류 무시
                    
            raise  # 오류 다시 발생시켜 아래 예외 처리로 전달
        
    except Exception as e:
        tb_str = traceback.format_exc()
        logger.error(f"스캔 시작 오류: {str(e)}\n{tb_str}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'스캔 시작에 실패했습니다: {str(e)}',
            'details': tb_str if DEBUG_MODE or current_app.config.get('DEBUG', False) else None
        }), 500

# 스캔 상태 조회 API
@scan_bp.route('/<scan_id>', methods=['GET', 'OPTIONS'])
def check_scan_status(scan_id):
    """스캔 작업의 상태를 조회하는 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        # CORS 헤더 추가
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
        
    try:
        # 요청 로깅
        logger.info(f"스캔 상태 조회: {scan_id}")
        
        try:
            scan_status = get_scan_status(scan_id)
        except ValueError as e:
            logger.error(f"스캔 상태 조회 오류: {str(e)}")
            return jsonify({
                'error': 'Not Found',
                'message': str(e)
            }), 404
        except Exception as e:
            logger.error(f"스캔 상태 조회 중 예외 발생: {str(e)}")
            # 오류 발생 시 테스트 데이터 반환 (프론트엔드 개발용)
            # 테스트 데이터 생성 목적으로 target이 필요함
            target = scan_id.split('-')[0] if '-' in scan_id else "127.0.0.1"
            return jsonify({
                'scan_id': scan_id,
                'target': target,
                'mode': ScanMode.TEST,
                'status': ScanStatus.COMPLETED,
                'start_time': 0,
                'end_time': 0,
                'duration': 0,
                'result': generate_test_data(target),
                'error': None,
                'message': '오류가 발생하여 테스트 데이터를 반환합니다.'
            })
        
        # 완료된 스캔의 경우 MongoDB에 결과 저장 시도 (optional)
        if scan_status['status'] == ScanStatus.COMPLETED:
            # 먼저 메모리에 결과 저장 확인
            if scan_id in scan_results:
                logger.info(f"스캔 결과가 메모리에 존재합니다: {scan_id}")
            
            # MongoDB에 저장 시도
            if hasattr(g, 'mongodb_available') and g.mongodb_available:
                try:
                    db = current_app.extensions['pymongo'].db
                    db.scans.update_one(
                        {'_id': scan_id},
                        {'$set': {
                            'status': ScanStatus.COMPLETED,
                            'completed_at': ObjectId().generation_time,
                            'duration': scan_status.get('duration', 0),
                            'result': loads(dumps(scan_status.get('result', {})))
                        }}
                    )
                    logger.info(f"MongoDB 스캔 결과 업데이트 성공: {scan_id}")
                except Exception as e:
                    logger.error(f"MongoDB 업데이트 오류 (메모리 상태 유지): {str(e)}")
                    # MongoDB 오류는 무시하고 계속 진행
            else:
                logger.warning(f"MongoDB 사용 불가. 결과는 메모리에만 저장됩니다: {scan_id}")
        
        # 응답에 CORS 헤더 추가 (보장을 위해)
        response = jsonify(scan_status)
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
        
    except Exception as e:
        tb_str = traceback.format_exc()
        logger.error(f"스캔 상태 조회 심각한 오류: {str(e)}\n{tb_str}")
        
        # 심각한 오류 발생 시 더미 데이터 반환 (UI 동작 위함)
        target = scan_id.split('-')[0] if '-' in scan_id else "127.0.0.1"
        return jsonify({
            'scan_id': scan_id,
            'target': target,
            'mode': ScanMode.TEST,
            'status': ScanStatus.COMPLETED,
            'start_time': 0,
            'end_time': 0,
            'duration': 0,
            'result': generate_test_data(target),
            'error': f'심각한 오류: {str(e)}',
            'recovery': True
        })

# 빠른 스캔 API 단축 경로
@scan_bp.route('/quick', methods=['POST', 'OPTIONS'])
def quick_scan_api():
    """빠른 스캔 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
    
    data = request.get_json() or {}
    if 'target' not in data:
        return jsonify({
            'error': 'Bad Request',
            'message': '대상(target)은 필수 항목입니다.'
        }), 400
        
    # 모드를 quick으로 설정하여 요청 변환
    data['mode'] = ScanMode.QUICK
    request.data = dumps(data).encode('utf-8')  # 요청 데이터 재설정
    return start_scan()

# 전체 스캔 API 단축 경로
@scan_bp.route('/full', methods=['POST', 'OPTIONS'])
def full_scan_api():
    """전체 스캔 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
    
    data = request.get_json() or {}
    if 'target' not in data:
        return jsonify({
            'error': 'Bad Request',
            'message': '대상(target)은 필수 항목입니다.'
        }), 400
        
    # 모드를 full로 설정하여 요청 변환
    data['mode'] = ScanMode.FULL
    request.data = dumps(data).encode('utf-8')  # 요청 데이터 재설정
    return start_scan()

# 사용자 정의 스캔 API 단축 경로
@scan_bp.route('/custom', methods=['POST', 'OPTIONS'])
def custom_scan_api():
    """사용자 정의 스캔 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
    
    data = request.get_json() or {}
    if 'target' not in data:
        return jsonify({
            'error': 'Bad Request',
            'message': '대상(target)은 필수 항목입니다.'
        }), 400
        
    # ports 또는 arguments가 없으면 에러
    if 'ports' not in data and 'arguments' not in data:
        return jsonify({
            'error': 'Bad Request',
            'message': '사용자 정의 스캔에는 ports 또는 arguments가 필요합니다.'
        }), 400
        
    # 모드를 custom으로 설정하여 요청 변환
    data['mode'] = ScanMode.CUSTOM
    request.data = dumps(data).encode('utf-8')  # 요청 데이터 재설정
    return start_scan()

# 최근 스캔 결과 목록 조회 API
@scan_bp.route('/history', methods=['GET', 'OPTIONS'])
def scan_history():
    """최근 스캔 결과 목록을 조회하는 API - 인증 제한 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
    
    try:
        if not hasattr(g, 'mongodb_available') or not g.mongodb_available:
            return jsonify({
                'error': 'Service Unavailable',
                'message': 'MongoDB를 사용할 수 없어 스캔 기록을 조회할 수 없습니다.'
            }), 503
            
        db = current_app.extensions['pymongo'].db
        limit = int(request.args.get('limit', 10))
        skip = int(request.args.get('skip', 0))
        
        # 스캔 기록 조회
        scans = db.scans.find({}, {
            'result': 0  # 결과는 크기가 클 수 있으므로 제외
        }).sort('_id', -1).skip(skip).limit(limit)
        
        return jsonify({
            'scans': loads(dumps(list(scans))),
            'count': db.scans.count_documents({})
        })
        
    except Exception as e:
        logger.error(f"스캔 기록 조회 오류: {str(e)}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'스캔 기록 조회에 실패했습니다: {str(e)}'
        }), 500

# 테스트 스캔 API - 인증 필요 없음
@scan_bp.route('/test', methods=['POST', 'OPTIONS'])
def test_scan_api():
    """테스트 스캔 API - 인증 필요 없음"""
    # OPTIONS 요청 처리 (CORS preflight)
    if request.method == 'OPTIONS':
        response = current_app.make_default_options_response()
        # CORS 헤더 추가
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Skip-Auth, X-Admin-Access'
        return response
        
    try:
        # 요청 로깅
        logger.info("테스트 스캔 요청 받음")
        logger.info(f"헤더: {dict(request.headers)}")
        
        # 요청 검증
        if not request.is_json:
            logger.warning("JSON 형식이 아닌 요청")
            # 클라이언트에서 올바른 헤더로 다시 시도하도록 유도
            return jsonify({
                'error': 'Bad Request',
                'message': 'JSON 콘텐츠 타입으로 요청해주세요'
            }), 400
            
        data = request.get_json() or {}
        logger.info(f"요청 데이터: {data}")
        
        if 'target' not in data:
            # 테스트 모드에서는 타겟이 없으면 기본값 사용
            data['target'] = '127.0.0.1'
            logger.info("타겟이 지정되지 않아 기본값 사용: 127.0.0.1")
            
        # 강제로 모드를 test로 설정
        data['mode'] = ScanMode.TEST
        
        # 테스트 스캔 ID 생성
        scan_id = f"test-{uuid.uuid4()}"
        
        # 테스트 스캔 결과 직접 반환 (즉시 완료)
        try:
            target = data['target']
            logger.info(f"테스트 스캔 타겟: {target}")
            
            # 테스트 데이터 생성
            test_result = test_scan(target)
            
            # 응답 준비
            response_data = {
                'scan_id': scan_id,
                'target': target,
                'mode': ScanMode.TEST,
                'status': ScanStatus.COMPLETED,
                'start_time': 0,
                'end_time': 0,
                'duration': 0,
                'result': test_result,
                'message': '테스트 모드 스캔 완료'
            }
            
            # CORS 헤더 명시적 추가 (이중 보장)
            response = jsonify(response_data)
            response.headers['Access-Control-Allow-Origin'] = '*'
            return response
            
        except Exception as e:
            logger.error(f"테스트 스캔 생성 중 오류: {str(e)}")
            return jsonify({
                'error': 'Server Error',
                'message': f'테스트 스캔 생성 중 오류 발생: {str(e)}'
            }), 500
            
    except Exception as e:
        tb_str = traceback.format_exc()
        logger.error(f"테스트 스캔 처리 중 심각한 오류: {str(e)}\n{tb_str}")
        return jsonify({
            'error': 'Internal Server Error',
            'message': f'테스트 스캔 처리 중 오류: {str(e)}',
            'details': tb_str if DEBUG_MODE or current_app.config.get('DEBUG', False) else None
        }), 500 