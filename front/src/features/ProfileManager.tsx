import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Alert } from '../components/ui/alert';
import apiService from '../services/api';

const ProfileManager: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('ProfileManager: 단순 버전 마운트됨');
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">프로필 관리 (단순화 버전)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>테스트 카드</CardTitle>
        </CardHeader>
        <CardContent>
          <p>카드가 보이시나요? 이것은 ProfileManager의 단순화된 버전입니다.</p>
          {error && <Alert>{error}</Alert>}
        </CardContent>
      </Card>
      
      <div className="p-4 bg-white rounded shadow">
        <h2 className="text-xl mb-2">일반 DIV로 만든 카드</h2>
        <p>Card 컴포넌트 대신 일반 div로 만든 컨테이너입니다.</p>
      </div>
    </div>
  );
};

export default ProfileManager; 