import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import httpClient from '../api/httpClient'
import { useToast } from '../context/ToastContext'

function AccessPage() {
  const { code } = useParams()
  const { addToast } = useToast()
  const [link, setLink] = useState(null)
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    let isMounted = true
    async function loadMetadata() {
      try {
        const { data } = await httpClient.get(`/links/${code}`)
        if (!isMounted) return
        setLink(data.link)
      } catch (err) {
        setError(err?.response?.data?.error || err.message || 'Unable to load link details')
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
      const { data } = await httpClient.post(`/links/${code}/verify`, { password })
      window.location.href = data.redirect_url
    } catch (err) {
      const message = err?.response?.data?.error || err.message || 'Verification failed'
      setError(message)
      addToast(message, 'error')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isLoading) {
    return (
      <main className="access-page">
        <div className="loading-card">
          <p>Loading link details...</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="access-page">
        <div className="error-panel">
          <h1>Cannot open link</h1>
          <p>{error}</p>
          <Link to="/">Return to dashboard</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="access-page">
      <section className="panel access-panel">
        <div className="panel-header">
          <span className="panel-tag">Secure link</span>
          <h2>Protected access for {link.short_code}</h2>
        </div>

        <p className="panel-copy">This link is password protected. Enter the password to unlock and continue.</p>

        <form onSubmit={handleVerify} className="access-form">
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter the link password"
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="error-pill inline">{error}</div> : null}

          <button type="submit" disabled={isVerifying || !password.trim()}>
            {isVerifying ? 'Verifying…' : 'Unlock link'}
          </button>
        </form>

        <div className="link-summary">
          <span>Original URL</span>
          <strong>{link.original_url}</strong>
        </div>
      </section>
    </main>
  )
}
export default AccessPage
