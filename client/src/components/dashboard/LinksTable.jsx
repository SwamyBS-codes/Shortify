import { useMemo, useState } from 'react'
import { useLinkWorkspace } from '../../context/LinkWorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from '../ui/StatusBadge'
import EmptyState from '../ui/EmptyState'
import SkeletonLoader from '../ui/SkeletonLoader'
import BulkActionsBar from './BulkActionsBar'
import { Link } from 'react-router-dom'
import { formatDateOnlyDisplay } from '../../utils/linkUtils'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'clicks', label: 'Most clicks' },
]

function LinksTable() {
  const {
    filteredLinks,
    links,
    searchQuery,
    statusFilter,
    folderFilter,
    tagFilter,
    folderOptions,
    tagOptions,
    sortBy,
    setSearchQuery,
    setStatusFilter,
    setFolderFilter,
    setTagFilter,
    setSortBy,
    clearFilters,
    copyShortLink,
    deleteLinkByCode,
    openEditModal,
    runBulkAction,
    isBulkBusy,
    isLoading,
  } = useLinkWorkspace()
  const { user } = useAuth()

  const [selectedCodes, setSelectedCodes] = useState(new Set())
  const [deletingCode, setDeletingCode] = useState(null)

  const visibleCodes = useMemo(() => filteredLinks.map((l) => l.code), [filteredLinks])
  const allVisibleSelected =
    visibleCodes.length > 0 && visibleCodes.every((code) => selectedCodes.has(code))

  function toggleSelect(code) {
    setSelectedCodes((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedCodes((prev) => {
        const next = new Set(prev)
        visibleCodes.forEach((code) => next.delete(code))
        return next
      })
    } else {
      setSelectedCodes((prev) => {
        const next = new Set(prev)
        visibleCodes.forEach((code) => next.add(code))
        return next
      })
    }
  }

  function clearSelection() {
    setSelectedCodes(new Set())
  }

  const selectedList = [...selectedCodes]

  async function handleBulkDelete() {
    if (!window.confirm(`Delete ${selectedList.length} link(s) permanently?`)) return
    await runBulkAction('delete', selectedList)
    clearSelection()
  }

  async function handleBulkDisable() {
    await runBulkAction('disable', selectedList)
    clearSelection()
  }

  async function handleBulkEnable() {
    await runBulkAction('enable', selectedList)
    clearSelection()
  }

  async function handleBulkExtend(days) {
    await runBulkAction('extend', selectedList, { extendDays: days })
    clearSelection()
  }

  async function handleDelete(code) {
    if (!window.confirm('Delete this link permanently?')) return
    setDeletingCode(code)
    try {
      await deleteLinkByCode(code)
      setSelectedCodes((prev) => {
        const next = new Set(prev)
        next.delete(code)
        return next
      })
    } finally {
      setDeletingCode(null)
    }
  }

  return (
    <section className="links-section" id="links-table">
      <div className="section-header">
        <h2>{user ? 'My Links' : 'All Links'}</h2>
        <p>
          {user
            ? 'Links saved to your account. Use folders and tags to organize.'
            : 'Browse all links. Sign in to save and manage only your links.'}
        </p>
      </div>

      <BulkActionsBar
        selectedCount={selectedList.length}
        onClear={clearSelection}
        onDelete={handleBulkDelete}
        onDisable={handleBulkDisable}
        onEnable={handleBulkEnable}
        onExtend={handleBulkExtend}
        isBusy={isBulkBusy}
      />

      <div className="table-toolbar">
        <label className="toolbar-field">
          <span>Search</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search URL, alias, tags, folder..."
          />
        </label>

        <label className="toolbar-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="scheduled">Scheduled</option>
            <option value="password protected">Password protected</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>

        {folderOptions.length > 1 ? (
          <label className="toolbar-field">
            <span>Folder</span>
            <select value={folderFilter} onChange={(event) => setFolderFilter(event.target.value)}>
              {folderOptions.map((f) => (
                <option key={f} value={f}>
                  {f === 'all' ? 'All folders' : f}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {tagOptions.length > 1 ? (
          <label className="toolbar-field">
            <span>Tag</span>
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              {tagOptions.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All tags' : t}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="toolbar-field">
          <span>Sort</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
          Reset
        </button>
      </div>

      {isLoading ? (
        <div className="table-loading">
          <SkeletonLoader rows={5} />
        </div>
      ) : links.length === 0 ? (
        <EmptyState
          title="No links yet"
          description="Create your first short link using the form above."
          action={
            <a href="#shortener" className="btn btn-primary">
              Shorten a URL
            </a>
          }
        />
      ) : filteredLinks.length === 0 ? (
        <EmptyState
          title="No matching links"
          description="Try adjusting your search or filter criteria."
          action={
            <button type="button" className="btn btn-ghost" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="table-scroll">
          <table className="links-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all visible links"
                  />
                </th>
                <th>Short URL</th>
                <th>Folder / Tags</th>
                <th>Protected</th>
                <th>Clicks</th>
                <th>Active period</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map((link) => (
                <tr key={link.id ?? link.code} className={selectedCodes.has(link.code) ? 'row-selected' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selectedCodes.has(link.code)}
                      onChange={() => toggleSelect(link.code)}
                      aria-label={`Select ${link.code}`}
                    />
                  </td>
                  <td>
                    <button type="button" className="link-copy-btn" onClick={() => copyShortLink(link.shortUrl)}>
                      {link.shortUrl}
                    </button>
                  </td>
                  <td>
                    <div className="folder-tags-cell">
                      {link.folder ? <span className="folder-pill">{link.folder}</span> : null}
                      {(link.tags || []).map((tag) => (
                        <span key={tag} className="tag-chip-sm">
                          {tag}
                        </span>
                      ))}
                      {!link.folder && !(link.tags || []).length ? '—' : null}
                    </div>
                  </td>
                  <td>{link.passwordProtected ? 'Yes' : 'No'}</td>
                  <td>{link.clicks.toLocaleString()}</td>
                  <td>
                    {link.startsAt
                      ? `${formatDateOnlyDisplay(link.startsAtIso || link.startsAt)} → ${formatDateOnlyDisplay(link.expiresAtIso || link.expiresAt) || '—'}`
                      : link.expiresAt
                        ? formatDateOnlyDisplay(link.expiresAtIso || link.expiresAt)
                        : 'Never'}
                  </td>
                  <td>
                    <StatusBadge status={link.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => copyShortLink(link.shortUrl)}>
                        Copy
                      </button>
                      <Link to={`/links/${link.code}`}>Details</Link>
                      <Link to={`/analytics/${link.code}`}>Analytics</Link>
                      <button type="button" onClick={() => openEditModal(link)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="danger-btn"
                        disabled={deletingCode === link.code}
                        onClick={() => handleDelete(link.code)}
                      >
                        {deletingCode === link.code ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default LinksTable
