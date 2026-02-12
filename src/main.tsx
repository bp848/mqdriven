import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../App';
import './index.css';
import { initializeTheme } from './theme';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

initializeTheme();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
