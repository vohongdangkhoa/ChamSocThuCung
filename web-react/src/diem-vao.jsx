import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ung-dung';
import './giao-dien.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
