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
} from '../data/linkStore.js'
import { getCachedOriginalUrl, setCachedOriginalUrl } from '../cache/redisCache.js'
import { buildShortUrl, createSlug, normalizeUrl, sanitizeSlug } from '../utils/slug.js'
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
])

function aliasIsAllowed(alias) {
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

function parseExpiration(expirationType, expirationValue) {
  if (!expirationType || expirationType === 'none') {
    return { expiration_type: null, expires_at: null }
  }

  if (expirationType === 'date' && expirationValue) {
    const expiresAt = new Date(expirationValue)
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error('Invalid expiration date')
    }
    return { expiration_type: 'date', expires_at: expiresAt }
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
    return { expiration_type: expirationType, expires_at: expiresAt }
  }

  throw new Error('Unsupported expiration option')
}

export async function getAllLinks() {
  const links = await getAllLinksData()

  return {
    success: true,
    links,
  }
}

export async function createShortLink(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Input must be an object with url')
  }

  const { url, customAlias, password, expirationType, expirationValue } = input

  if (!url) {
    throw new Error('URL is required')
  }

  const normalizedUrl = normalizeUrl(url)

  if (customAlias) {
    if (!aliasIsAllowed(customAlias)) {
      throw new Error('Custom alias is invalid or reserved')
    }

    const aliasExists = await checkCodeExists(customAlias.trim().toLowerCase())
    if (aliasExists) {
      throw new Error('Custom alias already exists')
    }
  }

  const existingLink = await queryUrlByOriginalUrl(normalizedUrl)
  if (existingLink && !customAlias && !password && !input.expirationType) {
    await setCachedOriginalUrl(existingLink.short_code, existingLink.original_url)
    return {
      success: true,
      ...existingLink,
      short_url: buildShortUrl(BASE_URL, existingLink.short_code),
      short_link: buildShortUrl(BASE_URL, existingLink.short_code),
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
  const { expiration_type, expires_at } = parseExpiration(expirationType, expirationValue)

  const saved = await addUrl({
    original_url: normalizedUrl,
    short_code: shortCode,
    custom_alias: customAlias ? sanitizeSlug(customAlias) : null,
    title,
    password_hash: passwordHash,
    is_password_protected: isPasswordProtected,
    expiration_type,
    expires_at,
  })

  await setCachedOriginalUrl(saved.short_code, normalizedUrl)

  return {
    success: true,
    ...saved,
    code: saved.short_code,
    short_url: buildShortUrl(BASE_URL, saved.short_code),
    short_link: buildShortUrl(BASE_URL, saved.short_code),
    reused: false,
  }
}

function assertLinkActive(link) {
  if (!link.is_active) {
    const error = new Error('Link is disabled')
    error.code = 'INACTIVE'
    throw error
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    const error = new Error('Link has expired')
    error.code = 'EXPIRED'
    throw error
  }
}

export async function getLinkMetadata(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Code is required')
  }

  const link = await queryUrlByShortCode(code.trim())
  return {
    id: link.id,
    original_url: link.original_url,
    short_code: link.short_code,
    custom_alias: link.custom_alias,
    short_url: buildShortUrl(BASE_URL, link.short_code),
    title: link.title,
    is_password_protected: link.is_password_protected,
    expires_at: link.expires_at,
    expiration_type: link.expiration_type,
    click_count: link.click_count,
    is_active: link.is_active,
    created_at: link.created_at,
    updated_at: link.updated_at,
  }
}

export async function verifyLinkPassword(code, password) {
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
  await recordVisit(link.id, {
    ip_address: null,
    country: null,
    device: 'Protected Access',
    browser: 'Password verified',
    os: 'Protected Access',
    referrer: null,
  })

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

  const cachedOriginalUrl = await getCachedOriginalUrl(trimmedCode)
  if (cachedOriginalUrl) {
    await incrementClicks(trimmedCode)
    return cachedOriginalUrl
  }

  const link = await queryUrlByShortCode(trimmedCode)
  assertLinkActive(link)

  if (link.is_password_protected) {
    const error = new Error('Link is password protected')
    error.code = 'PASSWORD_REQUIRED'
    throw error
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    const error = new Error('Link has expired')
    error.code = 'EXPIRED'
    throw error
  }

  await incrementClicks(trimmedCode)
  await recordVisit(link.id, visitMetadata)
  await setCachedOriginalUrl(trimmedCode, link.original_url)

  return link.original_url
}

export async function getDashboardSummary() {
  const stats = await getDashboardStats()
  const recentLinks = await getRecentLinks(10)

  return {
    success: true,
    summary: {
      total_links: stats.total_links,
      total_clicks: stats.total_clicks,
      max_clicks: stats.max_clicks,
      avg_clicks: Number(stats.avg_clicks).toFixed(2),
      protected_links: Number(stats.protected_links || 0),
    },
    recent_links: recentLinks,
  }
}

export async function getLinkAnalyticsSummary(code) {
  return getLinkAnalytics(code)
}
