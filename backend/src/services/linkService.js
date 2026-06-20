import bcrypt from 'bcryptjs'
import { URL } from 'node:url'
import {
  addUrl,
  incrementClicks,
  checkCodeExists,
  queryUrlByShortCode,
  queryUrlByOriginalUrl,
  getDashboardStats,
  getRecentLinks,
  getAllLinksData,
  recordVisit,
  getLinkAnalytics,
  updateUrl,
  deleteUrl,
} from '../data/linkStore.js'
import { getCachedOriginalUrl, setCachedOriginalUrl, deleteCachedOriginalUrl } from '../cache/redisCache.js'
import { buildShortUrl, createSlug, normalizeUrl, sanitizeSlug } from '../utils/slug.js'
import { formatLinkRow } from '../utils/formatLink.js'
import { BASE_URL } from '../config.js'

const RESERVED_ALIAS_KEYS = new Set([
  'admin',
  'api',
  'dashboard',
  'login',
  'signup',
  'access',
  'create',
  'help',
  'settings',
  'expired',
  'analytics',
  'links',
  'scheduled',
  'disabled',
])

export function aliasIsAllowed(alias) {
  if (!alias) return false
  const normalized = alias.trim().toLowerCase()
  return /^[a-z0-9_-]{4,32}$/.test(normalized) && !RESERVED_ALIAS_KEYS.has(normalized)
}

function getLinkTitle(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Link'
  }
}

function normalizeTags(tags) {
  if (!tags) return []
  const list = Array.isArray(tags) ? tags : String(tags).split(',')
  return [...new Set(list.map((t) => String(t).trim().toLowerCase()).filter((t) => t.length > 0 && t.length <= 32))].slice(
    0,
    10,
  )
}

function normalizeFolder(folder) {
  if (folder == null || folder === '') return null
  const trimmed = String(folder).trim().slice(0, 64)
  return trimmed || null
}

function assertNotOwnDomain(url, baseUrl = BASE_URL) {
  let parsedUrl
  let parsedBaseUrl

  try {
    parsedUrl = new URL(url)
    parsedBaseUrl = new URL(baseUrl)
  } catch {
    return
  }

  if (parsedUrl.hostname.toLowerCase() === parsedBaseUrl.hostname.toLowerCase()) {
    throw new Error('Unsupported URL: cannot shorten this service own domain')
  }
}

function parseExpiration(input) {
  const expirationType = input?.expirationType
  const expirationStartDate = input?.expirationStartDate
  const expirationEndDate = input?.expirationEndDate

  if (!expirationType || expirationType === 'none') {
    return { expiration_type: null, starts_at: null, expires_at: null }
  }

  if (expirationType === 'custom_range' || expirationType === 'custom') {
    if (!expirationStartDate || !expirationEndDate) {
      throw new Error('Start date and end date are required for custom date range')
    }
    const startsAt = new Date(expirationStartDate)
    const expiresAt = new Date(expirationEndDate)
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime())) {
      throw new Error('Invalid start or end date')
    }
    if (expiresAt <= startsAt) {
      throw new Error('End date must be after start date')
    }
    return { expiration_type: 'custom_range', starts_at: startsAt, expires_at: expiresAt }
  }

  const durationMap = {
    '1h': 1,
    '6h': 6,
    '12h': 12,
    '1d': 24,
    '7d': 168,
    '30d': 720,
  }

  if (durationMap[expirationType]) {
    const expiresAt = new Date(Date.now() + durationMap[expirationType] * 60 * 60 * 1000)
    return { expiration_type: expirationType, starts_at: null, expires_at: expiresAt }
  }

  throw new Error('Unsupported expiration option')
}

function canCacheLink(link) {
  if (link.is_password_protected) return false
  if (link.starts_at) return false
  if (link.expires_at) return false
  return true
}

function assertLinkOwnership(link, userId) {
  if (!userId) {
    if (link.user_id != null) {
      const error = new Error('Sign in to manage this link')
      error.code = 'FORBIDDEN'
      throw error
    }
    return
  }

  if (link.user_id == null || Number(link.user_id) !== Number(userId)) {
    const error = new Error('You do not have permission to manage this link')
    error.code = 'FORBIDDEN'
    throw error
  }
}

export async function getAllLinks(userId = null, baseUrl = BASE_URL) {
  const links = await getAllLinksData(userId)
  return {
    success: true,
    links: links.map((row) => formatLinkRow(row, baseUrl)),
  }
}

export async function checkAliasAvailability(alias) {
  const normalized = alias?.trim().toLowerCase()
  if (!normalized) {
    return { available: false, reason: 'Alias is required' }
  }
  if (!aliasIsAllowed(normalized)) {
    return { available: false, reason: 'Alias is invalid or reserved' }
  }
  const exists = await checkCodeExists(normalized)
  return { available: !exists, reason: exists ? 'Alias already taken' : null }
}

export async function createShortLink(input, userId = null, baseUrl = BASE_URL) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input must be an object with url')
  }

  const { url, customAlias, password, expirationType } = input

  if (!url) {
    throw new Error('URL is required')
  }

  const normalizedUrl = normalizeUrl(url)
  assertNotOwnDomain(normalizedUrl, baseUrl)

  if (customAlias) {
    const availability = await checkAliasAvailability(customAlias)
    if (!availability.available) {
      throw new Error(availability.reason || 'Custom alias is unavailable')
    }
  }

  const existingLink = await queryUrlByOriginalUrl(normalizedUrl)
    if (existingLink && !customAlias && !password && !input.expirationType) {
    if (canCacheLink(existingLink)) {
      await setCachedOriginalUrl(existingLink.short_code, existingLink.original_url)
    }
    return {
      success: true,
      ...formatLinkRow(existingLink, baseUrl),
      reused: true,
    }
  }

  let shortCode = customAlias ? sanitizeSlug(customAlias) : null

  if (!shortCode) {
    let attempts = 0
    const maxAttempts = 5
    while (attempts < maxAttempts) {
      const candidate = createSlug()
      const exists = await checkCodeExists(candidate)
      if (!exists) {
        shortCode = candidate
        break
      }
      attempts += 1
    }

    if (!shortCode) {
      throw new Error('Failed to generate unique slug after multiple attempts')
    }
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : null
  const isPasswordProtected = Boolean(passwordHash)
  const title = getLinkTitle(normalizedUrl)
  const { expiration_type, starts_at, expires_at } = parseExpiration(input)

  const saved = await addUrl({
    original_url: normalizedUrl,
    short_code: shortCode,
    custom_alias: customAlias ? sanitizeSlug(customAlias) : null,
    title,
    password_hash: passwordHash,
    is_password_protected: isPasswordProtected,
    expiration_type,
    starts_at,
    expires_at,
    user_id: userId,
    folder: normalizeFolder(input.folder),
    tags: normalizeTags(input.tags),
  })

  if (canCacheLink(saved)) {
    await setCachedOriginalUrl(saved.short_code, normalizedUrl)
  }

  return {
    success: true,
    ...formatLinkRow(saved, baseUrl),
    reused: false,
  }
}

function assertLinkActive(link) {
  if (!link.is_active) {
    const error = new Error('Link is disabled')
    error.code = 'INACTIVE'
    throw error
  }

  const now = new Date()

  if (link.starts_at && new Date(link.starts_at) > now) {
    const error = new Error('This link is not active yet')
    error.code = 'NOT_YET_ACTIVE'
    throw error
  }

  if (link.expires_at && new Date(link.expires_at) < now) {
    const error = new Error('Link has expired')
    error.code = 'EXPIRED'
    throw error
  }
}

export async function getLinkMetadata(code, options = {}, baseUrl = BASE_URL) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required')
  }

  const link = await queryUrlByShortCode(code.trim())
  const formatted = formatLinkRow(link, baseUrl)

  if (options.hideDestination || link.is_password_protected) {
    return {
      ...formatted,
      original_url: undefined,
      longUrl: undefined,
    }
  }

  return formatted
}

export async function verifyLinkPassword(code, password, visitMetadata = {}) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required')
  }

  const link = await queryUrlByShortCode(code.trim())
  assertLinkActive(link)

  if (!link.is_password_protected) {
    return link.original_url
  }

  if (!password) {
    throw new Error('Password is required')
  }

  const isValid = await bcrypt.compare(password, link.password_hash)
  if (!isValid) {
    const error = new Error('Incorrect password')
    error.code = 'INVALID_PASSWORD'
    throw error
  }

  await incrementClicks(link.short_code)
  await recordVisit(link.id, visitMetadata)

  return link.original_url
}

export async function resolveShortLink(code, visitMetadata = {}) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required')
  }

  const trimmedCode = code.trim()
  if (!trimmedCode) {
    throw new Error('Code is required')
  }

  const link = await queryUrlByShortCode(trimmedCode)
  assertLinkActive(link)

  if (link.is_password_protected) {
    const error = new Error('Link is password protected')
    error.code = 'PASSWORD_REQUIRED'
    throw error
  }

  const cachedOriginalUrl = await getCachedOriginalUrl(trimmedCode)
  if (cachedOriginalUrl && canCacheLink(link)) {
    await incrementClicks(trimmedCode)
    await recordVisit(link.id, visitMetadata)
    return cachedOriginalUrl
  }

  await incrementClicks(trimmedCode)
  await recordVisit(link.id, visitMetadata)

  if (canCacheLink(link)) {
    await setCachedOriginalUrl(trimmedCode, link.original_url)
  }

  return link.original_url
}

export async function updateShortLink(code, input, userId = null, baseUrl = BASE_URL) {
  const existing = await queryUrlByShortCode(code.trim())
  assertLinkOwnership(existing, userId)
  const updates = {}

  if (input.url) {
    updates.original_url = normalizeUrl(input.url)
    assertNotOwnDomain(updates.original_url, baseUrl)
  }

  if (input.customAlias !== undefined) {
    const newAlias = input.customAlias ? sanitizeSlug(input.customAlias) : null
    if (newAlias && newAlias !== existing.short_code) {
      if (!aliasIsAllowed(newAlias)) {
        throw new Error('Custom alias is invalid or reserved')
      }
      const exists = await checkCodeExists(newAlias)
      if (exists) {
        throw new Error('Custom alias already exists')
      }
      updates.short_code = newAlias
      updates.custom_alias = newAlias
      await deleteCachedOriginalUrl(existing.short_code)
    } else if (!newAlias) {
      updates.custom_alias = null
    }
  }

  if (input.isActive !== undefined) {
    updates.is_active = Boolean(input.isActive)
  }

  if (input.password !== undefined) {
    if (input.password) {
      updates.password_hash = await bcrypt.hash(input.password, 10)
      updates.is_password_protected = true
    } else {
      updates.password_hash = null
      updates.is_password_protected = false
    }
    await deleteCachedOriginalUrl(existing.short_code)
  } else if (input.protectWithPassword === false) {
    updates.password_hash = null
    updates.is_password_protected = false
    await deleteCachedOriginalUrl(existing.short_code)
  }

  if (input.expirationType !== undefined) {
    const { expiration_type, starts_at, expires_at } = parseExpiration(input)
    updates.expiration_type = expiration_type
    updates.starts_at = starts_at
    updates.expires_at = expires_at
    await deleteCachedOriginalUrl(existing.short_code)
  }

  if (input.folder !== undefined) {
    updates.folder = normalizeFolder(input.folder)
  }

  if (input.tags !== undefined) {
    updates.tags = normalizeTags(input.tags)
  }

  const saved = await updateUrl(existing.short_code, updates)

  if (canCacheLink(saved)) {
    await setCachedOriginalUrl(saved.short_code, saved.original_url)
  }

  return {
    success: true,
    ...formatLinkRow(saved, baseUrl),
  }
}

export async function deleteShortLink(code, userId = null) {
  const existing = await queryUrlByShortCode(code.trim())
  assertLinkOwnership(existing, userId)
  await deleteCachedOriginalUrl(code.trim())
  await deleteUrl(code.trim(), userId)
  return { success: true }
}

export async function bulkUpdateLinks(input, userId = null) {
  const { action, codes, extendDays } = input || {}
  if (!action || !Array.isArray(codes) || codes.length === 0) {
    throw new Error('Action and at least one link code are required')
  }

  const uniqueCodes = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))].slice(0, 100)
  const results = { success: 0, failed: [] }

  for (const code of uniqueCodes) {
    try {
      const existing = await queryUrlByShortCode(code)
      assertLinkOwnership(existing, userId)

      if (action === 'delete') {
        await deleteCachedOriginalUrl(code)
        await deleteUrl(code, userId)
        results.success += 1
        continue
      }

      if (action === 'disable') {
        await updateUrl(code, { is_active: false })
        await deleteCachedOriginalUrl(code)
        results.success += 1
        continue
      }

      if (action === 'enable') {
        await updateUrl(code, { is_active: true })
        results.success += 1
        continue
      }

      if (action === 'extend') {
        const days = Number(extendDays) || 7
        if (days < 1 || days > 365) {
          throw new Error('extendDays must be between 1 and 365')
        }
        const base = existing.expires_at && new Date(existing.expires_at) > new Date()
          ? new Date(existing.expires_at)
          : new Date()
        base.setDate(base.getDate() + days)
        await updateUrl(code, { expires_at: base, expiration_type: existing.expiration_type || 'extended' })
        await deleteCachedOriginalUrl(code)
        results.success += 1
        continue
      }

      throw new Error('Unsupported bulk action')
    } catch (error) {
      results.failed.push({ code, error: error.message })
    }
  }

  return { success: true, ...results }
}

function canManageLink(link, userId) {
  try {
    assertLinkOwnership(link, userId)
    return true
  } catch {
    return false
  }
}

export async function getLinkSettings(code, userId = null, baseUrl = BASE_URL) {
  const link = await queryUrlByShortCode(code.trim())
  const formatted = formatLinkRow(link, baseUrl)
  const isOwner = canManageLink(link, userId)

  const safe = {
    ...formatted,
    original_url: undefined,
    longUrl: undefined,
    canManage: isOwner,
    passwordProtected: Boolean(link.is_password_protected),
    hasPassword: Boolean(link.is_password_protected),
  }

  if (isOwner) {
    return {
      ...safe,
      original_url: link.original_url,
      longUrl: link.original_url,
      canManage: true,
    }
  }

  return safe
}

export async function getDashboardSummary(userId = null, baseUrl = BASE_URL) {
  const stats = await getDashboardStats(userId)
  const recentLinks = userId
    ? (await getAllLinksData(userId)).slice(0, 10)
    : await getRecentLinks(10)

  return {
    success: true,
    summary: {
      total_links: stats.total_links,
      total_clicks: stats.total_clicks,
      max_clicks: stats.max_clicks,
      avg_clicks: Number(stats.avg_clicks).toFixed(2),
      protected_links: Number(stats.protected_links || 0),
    },
    recent_links: recentLinks.map((row) => formatLinkRow(row, baseUrl)),
  }
}

export async function getLinkAnalyticsSummary(code, baseUrl = BASE_URL) {
  const analytics = await getLinkAnalytics(code)
  return {
    ...analytics,
    url: formatLinkRow(analytics.url, baseUrl),
  }
}
