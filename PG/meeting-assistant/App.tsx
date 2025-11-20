import React from 'react';
import MeetingAssistant from './components/MeetingAssistant';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xl p-6 md:p-8">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-800 mb-6 text-center">
          Meeting Assistant
        </h1>
        <MeetingAssistant />
      </div>
    </div>
  );
};

export default App;