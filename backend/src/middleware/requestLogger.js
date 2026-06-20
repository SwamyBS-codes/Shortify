import { randomUUID } from 'node:crypto'
import { logger } from '../utils/logger.js'

function getRequestId(req) {
  const requestId = req.get('x-request-id')
  return requestId || randomUUID()
}

export function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint()
  req.requestId = getRequestId(req)
  res.setHeader('X-Request-Id', req.requestId)

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    const statusCode = res.statusCode
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

    logger[level]('http_request_completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      contentLength: res.getHeader('content-length') || null,
      ip: req.ip,
      userAgent: req.get('user-agent') || null,
      origin: req.get('origin') || null,
      userId: req.user?.id ?? null,
    })
  })

  next()
}
