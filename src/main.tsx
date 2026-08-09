import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

const rootEl = document.getElementById('root');
// 严格模式下 getElementById 返回 HTMLElement | null，这里显式收敛，避免用 ! 断言
if (!rootEl) {
  throw new Error('找不到挂载点 #root');
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
