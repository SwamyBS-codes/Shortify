import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { initialLinks } from '../data/mockLinks'
import { getHostname } from '../utils/linkUtils'
import { createLink, fetchAllLinks, fetchDashboardSummary } from '../api/linksApi'
import { useToast } from './ToastContext'

const LinkWorkspaceContext = createContext(null)

export function LinkWorkspaceProvider({ children }) {
  const { addToast } = useToast()
  const [longUrl, setLongUrl] = useState('')
  const [links, setLinks] = useState(initialLinks)
  const [statusMessage, setStatusMessage] = useState('Ready to generate a branded short link.')
  const [generatedLink, setGeneratedLink] = useState(initialLinks[0])
  const [customAlias, setCustomAlias] = useState('')
  const [protectWithPassword, setProtectWithPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [expirationType, setExpirationType] = useState('none')
  const [expirationValue, setExpirationValue] = useState('')
  const [dashboardStats, setDashboardStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function hydrateLinks() {
      setIsLoading(true)
      setLoadError('')
      try {
        const [serverLinks, dashboard] = await Promise.all([
          fetchAllLinks(),
          fetchDashboardSummary(),
        ])

        if (!isMounted) {
          return
        }

        if (serverLinks.length > 0) {
          setLinks(serverLinks)
          setGeneratedLink(serverLinks[0])
        }

        setDashboardStats(dashboard?.summary || null)
        // setStatusMessage('Loaded links from backend.')
        addToast('Workspace loaded successfully.', 'success')
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Backend unreachable. Using local preview data.')
          setStatusMessage('Using local preview data.')
          addToast(error.message || 'Backend unreachable. Using local preview data.', 'error')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    hydrateLinks()

    return () => {
      isMounted = false
    }
  }, [])

  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0)
  const primaryDomain = getHostname(generatedLink.longUrl)

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredLinks = links.filter((link) => {
    const matchesSearch =
      !normalizedQuery ||
      [link.title, link.longUrl, link.shortUrl, link.code]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery)

    const matchesFilter =
      statusFilter === 'all' || link.status.toLowerCase() === statusFilter

    return matchesSearch && matchesFilter
  })

  const quickStats = dashboardStats
    ? [
        { label: 'Links in workspace', value: String(dashboardStats.total_links) },
        { label: 'Total clicks', value: Number(dashboardStats.total_clicks).toLocaleString() },
        { label: 'Top link clicks', value: Number(dashboardStats.max_clicks).toLocaleString() },
      ]
    : [
        { label: 'Links in workspace', value: links.length.toString() },
        { label: 'Total clicks', value: totalClicks.toLocaleString() },
        {
          label: 'Top link clicks',
          value: Math.max(...links.map((link) => link.clicks)).toLocaleString(),
        },
      ]

  async function copyShortLink(value) {
    try {
      await navigator.clipboard.writeText(value)
      setStatusMessage('Short link copied to clipboard.')
      addToast('Short link copied to clipboard.', 'success')
    } catch {
      setStatusMessage('Copy failed, but the short link is ready to use.')
      addToast('Copy failed, but the short link is ready to use.', 'error')
    }
  }

  async function createShortLink() {
    if (!longUrl.trim()) {
      setStatusMessage('Add a destination URL before generating a short link.')
      addToast('Add a destination URL before generating a short link.', 'error')
      return;
    }

    setIsCreating(true)
    setActionError('')

    try {
      const newLink = await createLink({
        url: longUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        password: protectWithPassword ? password : undefined,
        expirationType,
        expirationValue,
      })

      setLinks((current) => {
        const merged = [newLink, ...current]
        const deduped = []
        const seen = new Set()

        for (const link of merged) {
          const key = link?.id != null ? `id:${link.id}` : `code:${link.code}`
          if (seen.has(key)) {
            continue
          }
          seen.add(key)
          deduped.push(link)
        }

        return deduped.slice(0, 10)
      })
      setGeneratedLink(newLink)
      setCustomAlias('')
      setProtectWithPassword(false)
      setPassword('')
      setExpirationType('none')
      setExpirationValue('')
      try {
        const dashboard = await fetchDashboardSummary()
        setDashboardStats(dashboard?.summary || null)
      } catch {
        // Ignore stats refresh failures; link creation already succeeded.
      }
      setStatusMessage(`Created ${newLink.shortUrl} for ${getHostname(longUrl)}`)
      addToast(`Created ${newLink.shortUrl}`, 'success')
    } catch (error) {
      const message = error.message || 'Failed to create short link.'
      setActionError(message)
      setStatusMessage(message)
      addToast(message, 'error')
    } finally {
      setIsCreating(false)
    }
  }

  function clearFilters() {
    setSearchQuery('')
    setStatusFilter('all')
  }

  const value = useMemo(
    () => ({
      longUrl,
      links,
      filteredLinks,
      statusMessage,
      generatedLink,
      totalClicks,
      primaryDomain,
      quickStats,
      searchQuery,
      statusFilter,
      isLoading,
      isCreating,
      loadError,
      actionError,
      addToast,
      setLongUrl,
      setCustomAlias,
      setProtectWithPassword,
      setPassword,
      setExpirationType,
      setExpirationValue,
      setSearchQuery,
      setStatusFilter,
      copyShortLink,
      createShortLink,
      clearFilters,
    }),
    [
      longUrl,
      links,
      filteredLinks,
      statusMessage,
      generatedLink,
      totalClicks,
      primaryDomain,
      quickStats,
      searchQuery,
      statusFilter,
      isLoading,
      isCreating,
      loadError,
      actionError,
      addToast,
    ],
  )

  return <LinkWorkspaceContext.Provider value={value}>{children}</LinkWorkspaceContext.Provider>
}

export function useLinkWorkspace() {
  const context = useContext(LinkWorkspaceContext)

  if (!context) {
    throw new Error('useLinkWorkspace must be used inside LinkWorkspaceProvider')
  }

  return context
}
