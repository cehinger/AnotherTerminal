import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import '@xterm/xterm/css/xterm.css';

console.log('[App Init] Starting AnotherTerminal');
console.log('[App Init] xterm loaded:', typeof window !== 'undefined');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
