import React from 'react';

const BasicTest: React.FC = () => {
  return (
    <div className="p-4 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">기본 테스트 컴포넌트</h1>
      <p>이 컴포넌트는 UI 라이브러리를 사용하지 않고 순수 HTML과 Tailwind CSS만으로 만들어졌습니다.</p>
    </div>
  );
};

export default BasicTest; 