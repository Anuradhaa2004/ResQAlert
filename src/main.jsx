import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components.css'
import App from './App.jsx'

// Register PWA Service Worker for offline and native app installation
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('✅ ResQAlert PWA Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.warn('⚠️ Service Worker notice:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
