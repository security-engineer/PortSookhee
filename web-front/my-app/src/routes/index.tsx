import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import AuthLayout from '../layouts/AuthLayout';
import MainLayout from '../layouts/MainLayout';
import Login from '../components/auth/Login';
import Register from '../components/auth/Register';
import Topology from '../components/topology/Topology';
import VPNManager from '../components/vpn/VPNManager';
import TestPage from '../components/test/TestPage';

// 일반 인증 라우트 (비회원도 접근 가능)
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

// 실제 로그인한 회원만 접근 가능한 라우트
const MemberOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  // 로그인 상태가 아니거나 비회원이면 로그인 페이지로 리다이렉트
  if (!isAuthenticated || (user?.isGuest)) {
    alert('VPN 기능은 로그인 후 이용 가능합니다.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 인증 관련 라우트 */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* 메인 레이아웃 라우트 */}
      <Route element={<MainLayout />}>
        <Route path="/" element={
          <PrivateRoute>
            <Topology />
          </PrivateRoute>
        } />
        <Route path="/vpn" element={
          <MemberOnlyRoute>
            <VPNManager />
          </MemberOnlyRoute>
        } />
        <Route path="/test" element={
          <PrivateRoute>
            <TestPage />
          </PrivateRoute>
        } />
      </Route>

      {/* 기본 리다이렉트 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes; 