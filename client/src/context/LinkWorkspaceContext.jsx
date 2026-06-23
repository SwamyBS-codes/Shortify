import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { getHostname } from '../utils/linkUtils'
import {
  createLink,
  fetchAllLinks,
  fetchDashboardSummary,
  updateLink,
  deleteLink,
  bulkLinksAction,
  checkAliasAvailability,
} from '../api/linksApi'
import { dateInputToEndIso, dateInputToStartIso, parseTagsInput } from '../utils/linkUtils'
import { useToast } from './ToastContext'
import { useAuth } from './AuthContext'

const LinkWorkspaceContext = createContext(null)

function sortLinks(links, sortBy) {
  const copy = [...links]
  switch (sortBy) {
    case 'oldest':
      return copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    case 'clicks':
      return copy.sort((a, b) => b.clicks - a.clicks)
    default:
      return copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }
}

export function LinkWorkspaceProvider({ children }) {
  const { addToast } = useToast()
  const { user, isAuthLoading } = useAuth()
  const [longUrl, setLongUrl] = useState('')
  const [links, setLinks] = useState([])
  const [statusMessage, setStatusMessage] = useState('Ready to generate a branded short link.')
  const [generatedLink, setGeneratedLink] = useState(null)
  const [customAlias, setCustomAlias] = useState('')
  const [aliasStatus, setAliasStatus] = useState(null)
  const [protectWithPassword, setProtectWithPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expirationType, setExpirationType] = useState('none')
  const [expirationStartDate, setExpirationStartDate] = useState('')
  const [expirationEndDate, setExpirationEndDate] = useState('')
  const [linkFolder, setLinkFolder] = useState('')
  const [linkTagsInput, setLinkTagsInput] = useState('')
  const [folderFilter, setFolderFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [dashboardStats, setDashboardStats] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [editModalLink, setEditModalLink] = useState(null)
  const [isBulkBusy, setIsBulkBusy] = useState(false)

  const folderOptions = useMemo(() => {
    const folders = new Set(links.map((l) => l.folder).filter(Boolean))
    return ['all', ...folders]
  }, [links])

  const tagOptions = useMemo(() => {
    const tags = new Set(links.flatMap((l) => l.tags || []))
    return ['all', ...tags]
  }, [links])

  const refreshDashboard = useCallback(async () => {
    const dashboard = await fetchDashboardSummary()
    setDashboardStats(dashboard?.summary || null)
    return dashboard
  }, [])

  const refreshLinks = useCallback(async () => {
    const serverLinks = await fetchAllLinks()
    if (serverLinks.length > 0) {
      setLinks(serverLinks)
      setGeneratedLink((current) => serverLinks.find((l) => l.code === current?.code) || serverLinks[0])
    } else {
      setLinks([])
      setGeneratedLink(null)
    }
    return serverLinks
  }, [])

  useEffect(() => {
    if (isAuthLoading) return

    let isMounted = true

    async function hydrateLinks() {
      setIsLoading(true)
      setLoadError('')
      try {
        if (!user) {
          setLinks([])
          setGeneratedLink(null)
          setDashboardStats(null)
        } else {
          await Promise.all([refreshLinks(), refreshDashboard()])
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(error.message || 'Backend unreachable.')
          addToast(error.message || 'Backend unreachable.', 'error')
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
  }, [user, isAuthLoading, addToast, refreshDashboard, refreshLinks])

  useEffect(() => {
    if (!customAlias.trim() || customAlias.trim().length < 4) {
      setAliasStatus(null)
      return undefined
    }

    const timer = setTimeout(async () => {
      try {
        const result = await checkAliasAvailability(customAlias.trim())
        setAliasStatus(result)
      } catch {
        setAliasStatus(null)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [customAlias])

  const totalClicks = links.reduce((sum, link) => sum + link.clicks, 0)
  const primaryDomain = getHostname(generatedLink?.longUrl || '')

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredLinks = useMemo(() => {
    const filtered = links.filter((link) => {
      const matchesSearch =
        !normalizedQuery ||
        [link.title, link.longUrl, link.shortUrl, link.code, link.customAlias, link.folder, ...(link.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)

      const matchesFilter =
        statusFilter === 'all' || link.status.toLowerCase() === statusFilter.toLowerCase()

      const matchesFolder = folderFilter === 'all' || link.folder === folderFilter
      const matchesTag = tagFilter === 'all' || (link.tags || []).includes(tagFilter)

      return matchesSearch && matchesFilter && matchesFolder && matchesTag
    })
    return sortLinks(filtered, sortBy)
  }, [links, normalizedQuery, sortBy, statusFilter, folderFilter, tagFilter])

  const quickStats = useMemo(() => {
    return dashboardStats
      ? [
          { label: 'Total links', value: String(dashboardStats.total_links) },
          { label: 'Total clicks', value: Number(dashboardStats.total_clicks).toLocaleString() },
          { label: 'Protected links', value: String(dashboardStats.protected_links) },
          { label: 'Top link clicks', value: Number(dashboardStats.max_clicks).toLocaleString() },
        ]
      : [
          { label: 'Total links', value: links.length.toString() },
          { label: 'Total clicks', value: totalClicks.toLocaleString() },
          { label: 'Protected links', value: links.filter((l) => l.passwordProtected).length.toString() },
          {
            label: 'Top link clicks',
            value: Math.max(0, ...links.map((link) => link.clicks)).toLocaleString(),
          },
        ]
  }, [dashboardStats, links, totalClicks])

  const copyShortLink = useCallback(async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      addToast('Short link copied to clipboard.', 'success')
    } catch {
      addToast('Copy failed. Please copy manually.', 'error')
    }
  }, [addToast])

  const createShortLink = useCallback(async () => {
    if (!longUrl.trim()) {
      addToast('Add a destination URL before generating a short link.', 'error')
      return
    }

    if (aliasStatus && !aliasStatus.available) {
      addToast(aliasStatus.reason || 'Custom alias is unavailable.', 'error')
      return
    }

    if (expirationType === 'custom_range') {
      if (!expirationStartDate || !expirationEndDate) {
        addToast('Select both start and end dates for the custom range.', 'error')
        return
      }
      const startIso = dateInputToStartIso(expirationStartDate)
      const endIso = dateInputToEndIso(expirationEndDate)
      if (new Date(endIso) <= new Date(startIso)) {
        addToast('End date must be after start date.', 'error')
        return
      }
    }

    setIsCreating(true)
    setActionError('')

    try {
      const newLink = await createLink({
        url: longUrl.trim(),
        customAlias: customAlias.trim() || undefined,
        password: protectWithPassword ? password : undefined,
        expirationType,
        expirationStartDate: expirationType === 'custom_range' ? expirationStartDate : undefined,
        expirationEndDate: expirationType === 'custom_range' ? expirationEndDate : undefined,
        folder: linkFolder.trim() || undefined,
        tags: parseTagsInput(linkTagsInput),
      })

      setLinks((current) => {
        const merged = [newLink, ...current.filter((l) => l.code !== newLink.code)]
        return merged
      })
      setGeneratedLink(newLink)
      setCustomAlias('')
      setAliasStatus(null)
      setProtectWithPassword(false)
      setPassword('')
      setExpirationType('none')
      setExpirationStartDate('')
      setExpirationEndDate('')
      setLinkFolder('')
      setLinkTagsInput('')
      setLongUrl('')
      await refreshDashboard()
      setStatusMessage(`Created ${newLink.shortUrl}`)
      addToast(`Created ${newLink.shortUrl}`, 'success')
    } catch (error) {
      const message = error.message || 'Failed to create short link.'
      setActionError(message)
      addToast(message, 'error')
    } finally {
      setIsCreating(false)
    }
  }, [
    longUrl,
    aliasStatus,
    expirationType,
    expirationStartDate,
    expirationEndDate,
    customAlias,
    protectWithPassword,
    password,
    linkFolder,
    linkTagsInput,
    refreshDashboard,
    addToast
  ])

  const deleteLinkByCode = useCallback(async (code) => {
    try {
      await deleteLink(code)
      setLinks((current) => current.filter((link) => link.code !== code))
      await refreshDashboard()
      addToast('Link deleted.', 'success')
    } catch (error) {
      addToast(error.message || 'Failed to delete link.', 'error')
    }
  }, [refreshDashboard, addToast])

  const openEditModal = useCallback((link) => {
    setEditModalLink(link)
  }, [])

  const closeEditModal = useCallback(() => {
    setEditModalLink(null)
  }, [])

  const saveEditedLink = useCallback(async (code, form) => {
    if (form.expirationType === 'custom_range') {
      if (!form.expirationStartDate || !form.expirationEndDate) {
        addToast('Select both start and end dates for the custom range.', 'error')
        return
      }
      if (
        new Date(dateInputToEndIso(form.expirationEndDate)) <= new Date(dateInputToStartIso(form.expirationStartDate))
      ) {
        addToast('End date must be after start date.', 'error')
        return
      }
    }

    setIsSaving(true)
    try {
      const payload = {
        url: form.url,
        customAlias: form.customAlias,
        isActive: form.isActive,
        expirationType: form.expirationType,
        expirationStartDate: form.expirationType === 'custom_range' ? form.expirationStartDate : undefined,
        expirationEndDate: form.expirationType === 'custom_range' ? form.expirationEndDate : undefined,
        folder: form.folder?.trim() || null,
        tags: parseTagsInput(form.tagsInput),
      }

      if (form.protectWithPassword && form.password) {
        payload.password = form.password
      } else if (!form.protectWithPassword) {
        payload.protectWithPassword = false
      }

      const updated = await updateLink(code, payload)
      setLinks((current) => current.map((link) => (link.code === code ? updated : link)))
      if (generatedLink?.code === code) {
        setGeneratedLink(updated)
      }
      closeEditModal()
      addToast('Link updated successfully.', 'success')
    } catch (error) {
      addToast(error.message || 'Failed to update link.', 'error')
    } finally {
      setIsSaving(false)
    }
  }, [generatedLink, closeEditModal, addToast])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter('all')
    setFolderFilter('all')
    setTagFilter('all')
    setSortBy('newest')
  }, [])

  const runBulkAction = useCallback(async (action, codes, options = {}) => {
    if (!codes.length) return
    setIsBulkBusy(true)
    try {
      const result = await bulkLinksAction(action, codes, options)
      await refreshLinks()
      await refreshDashboard()
      const failed = result.failed?.length || 0
      addToast(
        failed
          ? `${result.success} succeeded, ${failed} failed.`
          : `Bulk ${action}: ${result.success} link(s) updated.`,
        failed ? 'error' : 'success',
      )
      return result
    } catch (error) {
      addToast(error.message || 'Bulk action failed.', 'error')
      throw error
    } finally {
      setIsBulkBusy(false)
    }
  }, [refreshLinks, refreshDashboard, addToast])

  const value = useMemo(
    () => ({
      longUrl,
      links,
      filteredLinks,
      statusMessage,
      generatedLink,
      customAlias,
      aliasStatus,
      protectWithPassword,
      password,
      showPassword,
      expirationType,
      expirationStartDate,
      expirationEndDate,
      linkFolder,
      linkTagsInput,
      folderFilter,
      tagFilter,
      folderOptions,
      tagOptions,
      totalClicks,
      primaryDomain,
      quickStats,
      searchQuery,
      statusFilter,
      sortBy,
      isLoading,
      isCreating,
      isSaving,
      loadError,
      actionError,
      editModalLink,
      setLongUrl,
      setCustomAlias,
      setProtectWithPassword,
      setPassword,
      setShowPassword,
      setExpirationType,
      setExpirationStartDate,
      setExpirationEndDate,
      setLinkFolder,
      setLinkTagsInput,
      setFolderFilter,
      setTagFilter,
      setSearchQuery,
      setStatusFilter,
      setSortBy,
      copyShortLink,
      createShortLink,
      deleteLinkByCode,
      openEditModal,
      closeEditModal,
      saveEditedLink,
      clearFilters,
      refreshLinks,
      runBulkAction,
      isBulkBusy,
    }),
    [
      longUrl,
      links,
      filteredLinks,
      statusMessage,
      generatedLink,
      customAlias,
      aliasStatus,
      protectWithPassword,
      password,
      showPassword,
      expirationType,
      expirationStartDate,
      expirationEndDate,
      linkFolder,
      linkTagsInput,
      folderFilter,
      tagFilter,
      folderOptions,
      tagOptions,
      totalClicks,
      primaryDomain,
      quickStats,
      searchQuery,
      statusFilter,
      sortBy,
      isLoading,
      isCreating,
      isSaving,
      loadError,
      actionError,
      editModalLink,
      isBulkBusy,
      copyShortLink,
      createShortLink,
      deleteLinkByCode,
      openEditModal,
      closeEditModal,
      saveEditedLink,
      clearFilters,
      refreshLinks,
      runBulkAction,
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
