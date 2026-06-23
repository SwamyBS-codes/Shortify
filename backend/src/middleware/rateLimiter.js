import { logger } from '../utils/logger.js'

function getClientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function getRetryAfterSeconds(resetAt) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

export function createRateLimiter({ name, windowMs, max }) {
  const hits = new Map()

  function cleanupExpiredEntries(now) {
    for (const [key, entry] of hits.entries()) {
      if (entry.resetAt <= now) {
        hits.delete(key)
      }
    }
  }

  return function rateLimiter(req, res, next) {
    if (req.method === 'OPTIONS') {
      return next()
    }

    const now = Date.now()
    const clientKey = getClientKey(req)
    const existing = hits.get(clientKey)
    const entry = existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs }

    entry.count += 1
    hits.set(clientKey, entry)

    const remaining = Math.max(0, max - entry.count)
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count === 1) {
      cleanupExpiredEntries(now)
    }

    if (entry.count <= max) {
      return next()
    }

    const retryAfter = getRetryAfterSeconds(entry.resetAt)
    res.setHeader('Retry-After', String(retryAfter))
    logger.warn('rate_limit_exceeded', {
      limiter: name,
      ip: clientKey,
      path: req.path,
      method: req.method,
      retryAfter,
    })

    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
      retryAfter,
    })
  }
}
