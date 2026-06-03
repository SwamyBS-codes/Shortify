import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { PORT, CLIENT_URL } from './config.js'
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
} from './services/linkService.js'
import { getLinkByCode, listLinks } from './data/linkStore.js'
import { generalRateLimiter, createLinkRateLimiter } from './middleware/rateLimiter.js'

const app = express()
app.use(helmet())
app.use(express.json())
app.use(cors())
app.use(generalRateLimiter)

app.get('/', (req, res) => {
  res.send('URL Shortener backend is running')
})

app.get('/api/listAllLinks', async (req, res) => {
  try {
    await listLinks(req, res)
  } catch (error) {
    console.error('Error fetching links:', error)
    res.status(500).json({ error: 'Failed to fetch links' })
  }
})

app.get('/api/links', async (req, res) => {
  try {
    const result = await getAllLinks()
    res.json(result)
  } catch (error) {
    console.error('Error listing links:', error)
    res.status(500).json({ error: 'Failed to list links' })
  }
})

app.get('/api/getLinkByCode/:code', async (req, res) => {
  try {
    await getLinkByCode(req, res)
  } catch (error) {
    console.error('Error fetching link by code:', error)
    res.status(500).json({ error: 'Failed to fetch link by code' })
  }
})

app.get('/api/links/:code', async (req, res) => {
  try {
    const metadata = await getLinkMetadata(req.params.code)
    res.json({ success: true, link: metadata })
  } catch (error) {
    console.error('Error fetching link metadata:', error)
    res.status(404).json({ error: error.message })
  }
})

app.post('/api/createlink', createLinkRateLimiter, async (req, res) => {
  try {
    const result = await createShortLink(req.body)
    res.json(result)
  } catch (error) {
    console.error('Error creating short link:', error)
    const message = error.message || 'Failed to create short link'

    if (/already exists/i.test(message)) {
      return res.status(409).json({ error: message })
    }

    if (/required|invalid|must be|unsupported|reserved/i.test(message)) {
      return res.status(400).json({ error: message })
    }

    res.status(500).json({ error: message })
  }
})

app.post('/api/links/:code/verify', async (req, res) => {
  try {
    const url = await verifyLinkPassword(req.params.code, req.body.password)
    res.json({ success: true, redirect_url: url })
  } catch (error) {
    console.error('Password verification failed:', error)
    const status = error.code === 'INVALID_PASSWORD' ? 401 : 400
    res.status(status).json({ error: error.message })
  }
})

app.get('/api/links/:code/analytics', async (req, res) => {
  try {
    const analytics = await getLinkAnalyticsSummary(req.params.code)
    res.json({ success: true, analytics })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/dashboard', async (req, res) => {
  try {
    const summary = await getDashboardSummary()
    res.json(summary)
  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard summary' })
  }
})

app.get('/api/resolveLink/:code', async (req, res, next) => {
  try {
    const location = await resolveShortLink(req.params.code)
    res.redirect(302, location)
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED') {
      return res.redirect(`${CLIENT_URL}/access/${req.params.code}`)
    }
    if (err.code === 'EXPIRED') {
      return res.status(410).json({ error: err.message })
    }
    next(err)
  }
})

app.get('/:code', async (req, res, next) => {
  try {
    const location = await resolveShortLink(req.params.code)
    res.redirect(302, location)
  } catch (err) {
    if (err.code === 'PASSWORD_REQUIRED') {
      return res.redirect(`${CLIENT_URL}/access/${req.params.code}`)
    }
    if (err.code === 'EXPIRED') {
      return res.status(410).json({ error: err.message })
    }
    next(err)
  }
})

async function startServer() {
  await setupDatabase()
  await initRedisCache()

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
