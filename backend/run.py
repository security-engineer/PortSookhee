#!/usr/bin/env python3
"""
PortSookhee 백엔드 실행 스크립트
사용법: python run.py [--debug]
"""

import os
import sys
from app import create_app

if __name__ == '__main__':
    # 환경 변수 설정
    debug_mode = '--debug' in sys.argv or '-d' in sys.argv
    
    # 사용법 출력
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        sys.exit(0)
        
    if debug_mode:
        os.environ['FLASK_ENV'] = 'development'
        print("Running in DEBUG mode")
    else:
        os.environ['FLASK_ENV'] = os.environ.get('FLASK_ENV', 'development')
        
    # 앱 생성
    app = create_app()
    
    # 실행
    app.run(
        host=os.environ.get('FLASK_HOST', '0.0.0.0'),
        port=int(os.environ.get('FLASK_PORT', 5000)),
        debug=debug_mode
    ) 