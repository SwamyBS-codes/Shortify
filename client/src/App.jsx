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
      <div className="loading-content">
        <ShortifyLogo />
        <h1>Loading your workspace</h1>
        <p>Fetching links and analytics…</p>
        <div className="loading-spinner-wrap">
          <div className="loading-spinner" />
        </div>
        <div className="loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
      <div className="loading-bg-grad"></div>
    </main>
  )
}

function DashboardGate() {
  const { isLoading } = useLinkWorkspace()
  const { isAuthLoading } = useAuth()
  const [minimumLoadingComplete, setMinimumLoadingComplete] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinimumLoadingComplete(true), 600)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading || isAuthLoading || !minimumLoadingComplete) {
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
