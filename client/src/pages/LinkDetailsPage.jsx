import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { fetchLinkSettings } from '../api/linksApi'
import { useAuth } from '../context/AuthContext'
import AppNavbar from '../components/layout/AppNavbar'
import StatusBadge from '../components/ui/StatusBadge'
import QrCodePanel from '../components/ui/QrCodePanel'
import { formatDateOnlyDisplay } from '../utils/linkUtils'
import ShortifyLogo from '../components/ShortifyLogo'

function LinkDetailsPage() {
  const { code } = useParams()
  const { user } = useAuth()
  const [link, setLink] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!code) return
    fetchLinkSettings(code)
      .then((data) => {
        setLink(data)
        setError('')
      })
      .catch((err) => setError(err.message || 'Failed to load link'))
      .finally(() => setLoading(false))
  }, [code])

  return (
    <>
      <AppNavbar />
      <main className="link-details-page">
        <div className="link-details-container">
          {loading ? (
            <p className="link-details-loading">Loading link details…</p>
          ) : error ? (
            <div className="standalone-card inline-card">
              <ShortifyLogo />
              <h1>Link unavailable</h1>
              <p>{error}</p>
              <Link to="/" className="btn btn-primary">
                Back to dashboard
              </Link>
            </div>
          ) : link ? (
            <>
              <div className="link-details-header">
                <div>
                  <span className="panel-tag">Link details</span>
                  <h1>{link.code}</h1>
                  <a href={link.shortUrl} target="_blank" rel="noreferrer" className="link-details-url">
                    {link.shortUrl}
                  </a>
                </div>
                <StatusBadge status={link.status} />
              </div>

              <div className="link-details-grid">
                <section className="details-panel">
                  <h2>Settings preview</h2>
                  <p className="details-note">
                    {link.canManage
                      ? 'You can manage this link. Destination URL is shown only to you.'
                      : 'Public preview — destination URL is hidden.'}
                  </p>
                  <dl className="details-list">
                    <div>
                      <dt>Status</dt>
                      <dd>{link.status}</dd>
                    </div>
                    <div>
                      <dt>Password protected</dt>
                      <dd>{link.passwordProtected || link.hasPassword ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Active</dt>
                      <dd>{link.isActive !== false ? 'Yes' : 'No (disabled)'}</dd>
                    </div>
                    <div>
                      <dt>Expiration type</dt>
                      <dd>{link.expirationType || 'none'}</dd>
                    </div>
                    {link.startsAt ? (
                      <div>
                        <dt>Active from</dt>
                        <dd>{formatDateOnlyDisplay(link.startsAtIso || link.startsAt)}</dd>
                      </div>
                    ) : null}
                    {link.expiresAt ? (
                      <div>
                        <dt>Active until</dt>
                        <dd>{formatDateOnlyDisplay(link.expiresAtIso || link.expiresAt)}</dd>
                      </div>
                    ) : null}
                    {link.folder ? (
                      <div>
                        <dt>Folder</dt>
                        <dd>{link.folder}</dd>
                      </div>
                    ) : null}
                    {link.tags?.length > 0 ? (
                      <div>
                        <dt>Tags</dt>
                        <dd className="tag-list">
                          {link.tags.map((tag) => (
                            <span key={tag} className="tag-chip">
                              {tag}
                            </span>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Total clicks</dt>
                      <dd>{Number(link.clicks || 0).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{link.createdAt}</dd>
                    </div>
                    {link.canManage && link.longUrl ? (
                      <div className="details-destination">
                        <dt>Destination (owner only)</dt>
                        <dd>
                          <a href={link.longUrl} target="_blank" rel="noreferrer">
                            {link.longUrl}
                          </a>
                        </dd>
                      </div>
                    ) : (
                      <div>
                        <dt>Destination</dt>
                        <dd className="muted">Hidden from public view</dd>
                      </div>
                    )}
                  </dl>
                </section>

                <aside className="details-aside">
                  <QrCodePanel value={link.shortUrl} size={140} />
                  <div className="details-actions">
                    <Link to={`/analytics/${link.code}`} className="btn btn-secondary btn-block">
                      View analytics
                    </Link>
                    {link.canManage ? (
                      <Link to="/#links-table" className="btn btn-primary btn-block">
                        Edit in dashboard
                      </Link>
                    ) : user ? (
                      <p className="details-hint">Sign in as the link owner to edit settings.</p>
                    ) : (
                      <p className="details-hint">Sign in to manage links you own.</p>
                    )}
                  </div>
                </aside>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </>
  )
}

export default LinkDetailsPage
