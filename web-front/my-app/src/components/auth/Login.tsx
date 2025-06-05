import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setCredentials, guestLogin } from '../../store/authSlice';
import axios from 'axios';
import './Login.css';

// API 응답 타입 정의
interface LoginResponse {
  message?: string;
  user?: {
    id?: string;
    username?: string;
    role?: string;
    _id?: string; // MongoDB ID 대응
  };
  token?: string;
}

// 에러 응답 타입 정의
interface ErrorResponse {
  message?: string;
  error?: string;
}

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // API 주소 결정
      const apiUrl = process.env.REACT_APP_API_BASE_URL 
        ? `${process.env.REACT_APP_API_BASE_URL}/auth/login` 
        : 'http://localhost:5000/api/auth/login';
      
      console.log('로그인 API 요청 주소:', apiUrl);
      console.log('로그인 요청 데이터:', { username, password });
      
      // Axios로 요청
      const response = await axios.post<LoginResponse>(apiUrl, { 
        username, 
        password 
      });
      
      console.log('로그인 성공 응답:', response.data);
      
      // 사용자 데이터 추출 - 다양한 응답 구조 대응
      const userData = response.data.user || {};
      const userId = userData.id || userData._id || `temp-${Date.now()}`;
      const responseToken = response.data.token || '';
      
      // 사용자 데이터를 Redux 스토어에 저장
      dispatch(setCredentials({ 
        user: {
          id: String(userId),
          username: userData.username || username,
          email: '',  // 빈 문자열로 설정
        }, 
        token: responseToken
      }));
      
      // 성공 시 홈으로 이동
      console.log('로그인 성공, 홈으로 이동');
      navigate('/');
    } catch (error: any) {
      console.error('로그인 오류:', error);
      
      // 오류 응답 처리
      if (error.response) {
        const errData = error.response.data;
        console.log('백엔드 오류 응답:', errData);
        const errMessage = 
          errData?.message || 
          errData?.error || 
          errData?.detail || 
          '로그인에 실패했습니다.';
        setError(errMessage);
      } else if (error.request) {
        setError('서버 응답이 없습니다. 네트워크 연결을 확인하세요.');
      } else {
        setError('로그인 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuest = () => {
    dispatch(guestLogin());
    navigate('/');
  };

  const handleRegister = () => {
    navigate('/register');
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit} className="login-form">
        <h2>로그인</h2>
        {error && <div className="error-message">{error}</div>}
        <div className="form-group">
          <label htmlFor="username">사용자 이름</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">비밀번호</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? '처리 중...' : '로그인'}
        </button>
        <button 
          type="button" 
          className="guest-button" 
          onClick={handleGuest}
          disabled={isLoading}
        >
          비회원으로 계속하기
        </button>
        <button 
          type="button" 
          className="register-button" 
          onClick={handleRegister}
          disabled={isLoading}
        >
          회원가입
        </button>
      </form>
    </div>
  );
};

export default Login; 