import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import './index.css'

// Clerk Publishable Key from environment variable
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

if (!CLERK_PUBLISHABLE_KEY) {
  console.error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

// ═══ Phase 1 Performance: Register Service Worker ═══
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('[App] Service Worker registered successfully:', registration.scope);
        
        // Check for updates periodically (every 30 seconds during app usage)
        setInterval(() => {
          registration.update().catch(err => {
            console.error('[App] Service Worker update check failed:', err);
          });
        }, 30000);
      })
      .catch((error) => {
        console.warn('[App] Service Worker registration failed:', error);
      });
  });
} else {
  console.info('[App] Service Workers not supported in this browser');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
)
