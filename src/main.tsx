import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Catch Vite dynamic import chunk load errors after new deployments and auto-refresh once
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, refreshing page for latest assets:', event);
  const reloadKey = 'vite_chunk_preload_reload';
  if (!sessionStorage.getItem(reloadKey)) {
    sessionStorage.setItem(reloadKey, 'true');
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
