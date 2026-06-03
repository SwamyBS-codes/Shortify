import { useLinkWorkspace } from '../context/LinkWorkspaceContext'
import { QRCodeCanvas } from 'qrcode.react'

function LinkBuilderSection() {
  const {
    longUrl,
    generatedLink,
    setLongUrl,
    createShortLink,
    copyShortLink,
    isCreating,
    actionError,
    customAlias,
    setCustomAlias,
    protectWithPassword,
    setProtectWithPassword,
    password,
    setPassword,
    expirationType,
    setExpirationType,
    expirationValue,
    setExpirationValue,
  } = useLinkWorkspace()

  function handleSubmit(event) {
    event.preventDefault()
    createShortLink()
  }

  return (
    <section className="workspace-section">
      <form id="link-form" className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel-header">
          <span className="panel-tag">Generator</span>
          <h2>Short link builder</h2>
        </div>

        <label>
          Destination URL
          <input
            type="url"
            value={longUrl}
            onChange={(event) => setLongUrl(event.target.value)}
            placeholder="Enter the long URL"
            autoComplete="off"
          />
        </label>

        <label>
          Custom alias
          <input
            type="text"
            value={customAlias}
            onChange={(event) => setCustomAlias(event.target.value)}
            placeholder="my-portfolio or my-special-link"
            autoComplete="off"
          />
        </label>

        <div className="field-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={protectWithPassword}
              onChange={(event) => setProtectWithPassword(event.target.checked)}
            />
            Password protect link
          </label>

          <label>
            Expiration
            <select value={expirationType} onChange={(event) => setExpirationType(event.target.value)}>
              <option value="none">Never</option>
              <option value="1h">1 hour</option>
              <option value="6h">6 hours</option>
              <option value="12h">12 hours</option>
              <option value="1d">1 day</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
              <option value="date">Choose date</option>
            </select>
          </label>
        </div>

        {protectWithPassword ? (
          <label>
            Access password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter a secure password"
              autoComplete="new-password"
            />
          </label>
        ) : null}

        {expirationType === 'date' ? (
          <label>
            Expire on
            <input
              type="datetime-local"
              value={expirationValue}
              onChange={(event) => setExpirationValue(event.target.value)}
            />
          </label>
        ) : null}

        <div className="form-note">
          Use this panel as a pure UI sandbox: shape labels, helper text, and
          field grouping without relying on API responses.
        </div>

        {actionError ? <div className="error-pill">{actionError}</div> : null}

        <button className="form-button" type="submit" disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Generate short link'}
        </button>
      </form>

      <aside className="panel preview-panel">
        <div className="panel-header">
          <span className="panel-tag">Preview</span>
          <h2>Generated link card</h2>
        </div>

        <div className="preview-card">
          <span className="preview-label">Short URL</span>
          <strong>{generatedLink.shortUrl}</strong>
          <p>{generatedLink.longUrl}</p>

          <div className="qr-zone">
            <QRCodeCanvas value={generatedLink.shortUrl} size={138} />
            <p>Scan the QR code to open the link instantly.</p>
          </div>

          <div className="preview-actions">
            <button type="button" onClick={() => copyShortLink(generatedLink.shortUrl)}>
              Copy link
            </button>
            <a href={generatedLink.shortUrl} target="_blank" rel="noreferrer noopener">
              Open link
            </a>
          </div>
        </div>

        <div className="preview-meta">
          <div>
            <span>Code</span>
            <strong>{generatedLink.code}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{generatedLink.status}</strong>
          </div>
          <div>
            <span>Created</span>
            <strong>{generatedLink.createdAt}</strong>
          </div>
        </div>
      </aside>
    </section>
  )
}

export default LinkBuilderSection
