import React from 'react';
import ReactDOM from 'react-dom/client';
import AITranscriptionStandalone from '../components/AITranscriptionStandalone';

// Mock implementations for standalone mode
const addToast = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
  console.log(`Toast: ${message} (${type})`);
};

const isAIOff = false; // Set to true to disable AI features

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AITranscriptionStandalone addToast={addToast} isAIOff={isAIOff} />
  </React.StrictMode>,
);
