import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './auth/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GoogleOAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
