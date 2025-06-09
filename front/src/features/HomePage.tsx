import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
          네트워크 취약점 분석 시스템
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          이 시스템은 네트워크 환경의 보안 취약점을 탐지하고 분석하여 보안 위협을 사전에 방지하는 데 도움을 줍니다.
          VPN 연결을 통한 안전한 스캔과 분석 결과 리포트 생성까지 원스톱으로 제공합니다.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-blue-700 dark:text-blue-300">스캔</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              대상 네트워크나 호스트를 스캔하여 열린 포트와 실행 중인 서비스를 식별합니다.
            </p>
            <Link to="/scan" className="inline-block px-4 py-2 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 transition-colors">
              스캔 시작
            </Link>
          </div>

          <div className="bg-green-50 dark:bg-green-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-green-700 dark:text-green-300">기록</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              이전에 실행한 스캔 결과를 확인하고 시간에 따른 보안 상태 변화를 모니터링합니다.
            </p>
            <Link to="/history" className="inline-block px-4 py-2 bg-green-500 text-white font-medium rounded hover:bg-green-600 transition-colors">
              기록 보기
            </Link>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/30 p-5 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-2 text-purple-700 dark:text-purple-300">VPN 관리</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              안전한 스캔을 위한 VPN 연결을 설정하고 관리합니다.
            </p>
            <Link to="/vpn" className="inline-block px-4 py-2 bg-purple-500 text-white font-medium rounded hover:bg-purple-600 transition-colors">
              VPN 설정
            </Link>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-lg">
          <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">시작하는 방법</h2>
          <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2">
            <li>VPN 관리 페이지에서 안전한 스캔을 위한 VPN 연결을 설정합니다.</li>
            <li>스캔 페이지에서 대상 네트워크 또는 호스트와 스캔 옵션을 지정합니다.</li>
            <li>스캔 결과를 분석하고 취약점을 확인합니다.</li>
            <li>보안 조치를 취하고 기록 페이지에서 이전 스캔과 비교합니다.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default HomePage; 