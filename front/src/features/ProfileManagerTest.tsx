import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';

const ProfileManagerTest: React.FC = () => {
  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>간단한 프로필 테스트</CardTitle>
      </CardHeader>
      <CardContent>
        <p>이것은 Card 컴포넌트 렌더링 테스트입니다.</p>
      </CardContent>
    </Card>
  );
};

export default ProfileManagerTest; 