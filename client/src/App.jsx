import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { LinkWorkspaceProvider } from './context/LinkWorkspaceContext'
import { ToastProvider } from './context/ToastContext'
import DashboardPage from './pages/DashboardPage'
import AccessPage from './pages/AccessPage'
import ExpiredPage from './pages/ExpiredPage'
import ScheduledPage from './pages/ScheduledPage'
import DisabledPage from './pages/DisabledPage'
import LinkDetailsPage from './pages/LinkDetailsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuthModal from './components/auth/AuthModal'
import { useLinkWorkspace } from './context/LinkWorkspaceContext'
import { useAuth } from './context/AuthContext'
import ToastViewport from './components/ToastViewport'
import { useEffect, useState } from 'react'
import ShortifyLogo from './components/ShortifyLogo'

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-label="Loading Shortify">
      <div className="loading-bg-emojis">
        <span className="emoji emoji-1">🔗</span>
        <span className="emoji emoji-2">🔗</span>
        <span className="emoji emoji-3">🔗</span>
        <span className="emoji emoji-4">🔗</span>
        <span className="emoji emoji-5">🔗</span>
        <span className="emoji emoji-6">🔗</span>
      </div>
      <div className="loading-bg-grad"></div>
      <div className="loading-container">
        <div className="loading-content">
          <div className="logo-animation">
            <ShortifyLogo />
          </div>
          <h1 className="loading-title">Loading your workspace</h1>
          <p className="loading-subtitle">Fetching links and analytics…</p>
          <div className="loading-spinner-wrap">
            <div className="loading-spinner" />
          </div>
          <div className="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </main>
  )
}

import { useRef } from 'react'

function DashboardGate() {
  const { isLoading } = useLinkWorkspace()
  const { isAuthLoading } = useAuth()

  const hasInitialized = useRef(false)

  // Mark the app as initialized once the initial load finishes
  if (!isLoading && !isAuthLoading) {
    hasInitialized.current = true
  }

  // Show full-screen loader only during the first app load
  if (!hasInitialized.current && (isLoading || isAuthLoading)) {
    return <LoadingScreen />
  }

  return <DashboardPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardGate />} />
      <Route path="/access/:code" element={<AccessPage />} />
      <Route path="/scheduled/:code" element={<ScheduledPage />} />
      <Route path="/disabled/:code" element={<DisabledPage />} />
      <Route path="/expired/:code" element={<ExpiredPage />} />
      <Route path="/links/:code" element={<LinkDetailsPage />} />
      <Route path="/analytics/:code" element={<AnalyticsPage />} />
    </Routes>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <LinkWorkspaceProvider>
              <AppRoutes />
              <AuthModal />
              <ToastViewport />
            </LinkWorkspaceProvider>
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
