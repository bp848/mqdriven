import React from 'react';

interface OtsuboneAIProps {
  currentUser: any;
  onDataSubmit?: (type: string, data: any) => Promise<void>;
}

const OtsuboneAI: React.FC<OtsuboneAIProps> = ({ currentUser, onDataSubmit }) => {
  // 緊急非表示: 社長の指示によりチャットウィジェットを完全に非表示
  return null;
};

export default OtsuboneAI;
