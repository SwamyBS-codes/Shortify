import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchLinkMetadata, verifyLinkPassword } from '../api/linksApi'
import { useToast } from '../context/ToastContext'
import ShortifyLogo from '../components/ShortifyLogo'

function AccessUrlAnimation() {
  return (
    <>
      <div className="loading-bg-emojis" aria-hidden="true">
        <span className="emoji emoji-1">🔗</span>
        <span className="emoji emoji-2">🔗</span>
        <span className="emoji emoji-3">🔗</span>
        <span className="emoji emoji-4">🔗</span>
        <span className="emoji emoji-5">🔗</span>
        <span className="emoji emoji-6">🔗</span>
      </div>
      <div className="loading-bg-grad" aria-hidden="true"></div>
    </>
  )
}

function AccessPage() {
  const { code } = useParams()
  const { addToast } = useToast()
  const [link, setLink] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadMetadata() {
      try {
        const metadata = await fetchLinkMetadata(code)
        if (!isMounted) return
        setLink(metadata)
      } catch (err) {
        setError(err.message || 'Unable to load link details')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadMetadata()
    return () => {
      isMounted = false
    }
  }, [code])

  async function handleVerify(event) {
    event.preventDefault()
    setIsVerifying(true)
    setError('')

    try {
      const data = await verifyLinkPassword(code, password)
      window.location.href = data.redirect_url
    } catch (err) {
      const message = err.message || 'Verification failed'
      setError(message)
      addToast(message, 'error')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <main className="standalone-page access-page">
        <AccessUrlAnimation />
        <div className="standalone-card">
          <div className="loading-spinner" />
          <p style={{ marginTop: 16 }}>Loading secure link…</p>
        </div>
      </main>
    )
  }

  if (!link && error) {
    return (
      <main className="standalone-page access-page">
        <AccessUrlAnimation />
        <div className="standalone-card">
          <ShortifyLogo />
          <h1>Cannot open link</h1>
          <p>{error}</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 24 }}>
            Return to dashboard
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="standalone-page access-page">
      <AccessUrlAnimation />
      <div className="standalone-card access-card">
        <ShortifyLogo />
        <div className="standalone-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1>Password protected</h1>
        <p>Enter the password to unlock this link and continue.</p>

        <form onSubmit={handleVerify} className="access-form">
          <label>
            Password
            <div className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter the link password"
                autoComplete="current-password"
                autoFocus
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <button type="submit" className="btn btn-primary access-submit" disabled={isVerifying || !password.trim()}>
            {isVerifying ? 'Verifying…' : 'Unlock & continue'}
          </button>
        </form>

        <div className="link-summary">
          <span>Short URL</span>
          <strong>{link.shortUrl}</strong>
        </div>
      </div>
    </main>
  )
}

export default AccessPage
