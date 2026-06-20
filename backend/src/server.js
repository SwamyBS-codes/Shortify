import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PORT, CLIENT_URL, BASE_URL } from './config.js'
import { initRedisCache } from './cache/redisCache.js'
import { setupDatabase } from './setupDb.js'
import {
  createShortLink,
  getDashboardSummary,
  resolveShortLink,
  getLinkMetadata,
  verifyLinkPassword,
  getLinkAnalyticsSummary,
  getAllLinks,
  checkAliasAvailability,
  updateShortLink,
  deleteShortLink,
  bulkUpdateLinks,
  getLinkSettings,
} from './services/linkService.js'
import { getLinkByCode, listLinks } from './data/linkStore.js'
import { extractVisitMetadata } from './utils/visitMetadata.js'
import { optionalAuth } from './middleware/optionalAuth.js'
import { requestLogger } from './middleware/requestLogger.js'
import { registerUser, loginUser, getUserProfile } from './services/authService.js'
import { logger, logError } from './utils/logger.js'

const app = express()
app.set('trust proxy', 1)
app.use(helmet())
app.use(requestLogger)
app.use(express.json({ limit: '16kb' }))
const rawClientUrls = process.env.CLIENT_URL || ''
const allowedOrigins = rawClientUrls.split(',').map((s) => s.trim()).filter(Boolean)
if (allowedOrigins.length === 0) {
  allowedOrigins.push('http://localhost:5173')
}
// include known production frontend by default
if (!allowedOrigins.includes('https://shortify-urlshortner.vercel.app')) {
  allowedOrigins.push('https://shortify-urlshortner.vercel.app')
}
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    logger.warn('cors_origin_blocked', { origin })
    callback(null, false)
  },
  credentials: true,
}
app.use(cors(corsOptions))
// Some path-to-regexp versions reject '*' when registering routes.
// Handle preflight OPTIONS requests with the CORS middleware directly instead.
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return cors(corsOptions)(req, res, next)
  }
  next()
})
app.use(optionalAuth)

function handleServiceError(res, error, fallback = 'Request failed') {
  const message = error.message || fallback

  if (error.code === 'INVALID_PASSWORD') {
    return res.status(401).json({ error: message })
  }
  if (error.code === 'EXPIRED') {
    return res.status(410).json({ error: message, code: 'EXPIRED' })
  }
  if (error.code === 'INACTIVE') {
    return res.status(403).json({ error: message, code: 'INACTIVE' })
  }
  if (error.code === 'FORBIDDEN') {
    return res.status(403).json({ error: message })
  }
  if (/already exists/i.test(message)) {
    return res.status(409).json({ error: message })
  }
  if (/required|invalid|must be|unsupported|reserved|unavailable/i.test(message)) {
    return res.status(400).json({ error: message })
  }
  if (/not found/i.test(message)) {
    return res.status(404).json({ error: message })
  }

  return res.status(500).json({ error: message })
}

function logRouteError(req, message, error) {
  logError(message, error, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?.id ?? null,
  })
}

app.get('/', (req, res) => {
  res.send('URL Shortener backend is running')
})

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerUser(req.body)
    res.json({ success: true, ...result })
  } catch (error) {
    logRouteError(req, 'registration_failed', error)
    handleServiceError(res, error, 'Registration failed')
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await loginUser(req.body)
    res.json({ success: true, ...result })
  } catch (error) {
    logRouteError(req, 'login_failed', error)
    handleServiceError(res, error, 'Login failed')
  }
})

app.get('/api/auth/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.json({ success: true, user: null })
    }
    const user = await getUserProfile(req.user.id)
    res.json({ success: true, user })
  } catch (error) {
    logRouteError(req, 'profile_fetch_failed', error)
    handleServiceError(res, error, 'Failed to fetch profile')
  }
})

app.get('/api/listAllLinks', async (req, res) => {
  try {
    await listLinks(req, res)
  } catch (error) {
    logRouteError(req, 'legacy_links_fetch_failed', error)
    res.status(500).json({ error: 'Failed to fetch links' })
  }
})

app.get('/api/links', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const result = await getAllLinks(req.user?.id ?? null, baseUrl)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'links_list_failed', error)
    res.status(500).json({ error: 'Failed to list links' })
  }
})

app.get('/api/getLinkByCode/:code', async (req, res) => {
  try {
    await getLinkByCode(req, res)
  } catch (error) {
    logRouteError(req, 'legacy_link_fetch_failed', error)
    res.status(500).json({ error: 'Failed to fetch link by code' })
  }
})

app.get('/api/aliases/:alias/check', async (req, res) => {
  try {
    const result = await checkAliasAvailability(req.params.alias)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'alias_check_failed', error)
    res.status(500).json({ error: 'Failed to check alias availability' })
  }
})

app.post('/api/links/bulk', async (req, res) => {
  try {
    const result = await bulkUpdateLinks(req.body, req.user?.id ?? null)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'bulk_link_action_failed', error)
    handleServiceError(res, error, 'Bulk action failed')
  }
})

app.get('/api/links/:code/settings', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const settings = await getLinkSettings(req.params.code, req.user?.id ?? null, baseUrl)
    res.json({ success: true, link: settings })
  } catch (error) {
    logRouteError(req, 'link_settings_fetch_failed', error)
    handleServiceError(res, error, 'Failed to fetch link settings')
  }
})

app.get('/api/links/:code', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const metadata = await getLinkMetadata(req.params.code, { hideDestination: true }, baseUrl)
    res.json({ success: true, link: metadata })
  } catch (error) {
    logRouteError(req, 'link_metadata_fetch_failed', error)
    handleServiceError(res, error, 'Failed to fetch link metadata')
  }
})

app.post('/api/createlink', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const result = await createShortLink(req.body, req.user?.id ?? null, baseUrl)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'link_create_failed', error)
    handleServiceError(res, error, 'Failed to create short link')
  }
})

app.put('/api/links/:code', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const result = await updateShortLink(req.params.code, req.body, req.user?.id ?? null, baseUrl)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'link_update_failed', error)
    handleServiceError(res, error, 'Failed to update link')
  }
})

app.delete('/api/links/:code', async (req, res) => {
  try {
    const result = await deleteShortLink(req.params.code, req.user?.id ?? null)
    res.json(result)
  } catch (error) {
    logRouteError(req, 'link_delete_failed', error)
    handleServiceError(res, error, 'Failed to delete link')
  }
})

app.post('/api/links/:code/verify', async (req, res) => {
  try {
    const visitMetadata = extractVisitMetadata(req)
    const url = await verifyLinkPassword(req.params.code, req.body.password, visitMetadata)
    res.json({ success: true, redirect_url: url })
  } catch (error) {
    logRouteError(req, 'password_verification_failed', error)
    handleServiceError(res, error, 'Password verification failed')
  }
})

app.get('/api/links/:code/analytics', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const analytics = await getLinkAnalyticsSummary(req.params.code, baseUrl)
    res.json({ success: true, analytics })
  } catch (error) {
    logRouteError(req, 'analytics_fetch_failed', error)
    handleServiceError(res, error, 'Failed to fetch analytics')
  }
})

app.get('/api/dashboard', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`
    const summary = await getDashboardSummary(req.user?.id ?? null, baseUrl)
    res.json(summary)
  } catch (error) {
    logRouteError(req, 'dashboard_summary_fetch_failed', error)
    res.status(500).json({ error: 'Failed to fetch dashboard summary' })
  }
})

async function handleRedirect(req, res, next) {
  try {
    const visitMetadata = extractVisitMetadata(req)
    const location = await resolveShortLink(req.params.code, visitMetadata)
    res.redirect(302, location)
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED') {
      return res.redirect(`${CLIENT_URL}/access/${req.params.code}`)
    }
    if (err.code === 'EXPIRED') {
      return res.redirect(`${CLIENT_URL}/expired/${req.params.code}`)
    }
    if (err.code === 'NOT_YET_ACTIVE') {
      return res.redirect(`${CLIENT_URL}/scheduled/${req.params.code}`)
    }
    if (err.code === 'INACTIVE') {
      return res.redirect(`${CLIENT_URL}/disabled/${req.params.code}`)
    }
    if (/not found/i.test(err.message)) {
      return res.status(404).json({ error: err.message })
    }
    next(err)
  }
}

app.get('/api/resolveLink/:code', handleRedirect)
app.get('/favicon.ico', (req, res) => {
  res.status(204).end()
})
app.get('/:code', handleRedirect)

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err)
  }

  logRouteError(req, 'unhandled_request_error', err)
  res.status(500).json({
    error: 'Internal server error',
    requestId: req.requestId,
  })
})

async function startServer() {
  await setupDatabase()
  await initRedisCache()

  app.listen(PORT, () => {
    logger.info('server_started', {
      port: PORT,
      baseUrl: BASE_URL,
      clientUrl: CLIENT_URL,
    })
  })
}

startServer().catch((error) => {
  logError('server_start_failed', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logError('unhandled_rejection', error)
})

process.on('uncaughtException', (error) => {
  logError('uncaught_exception', error)
  process.exit(1)
})
