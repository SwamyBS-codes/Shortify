const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const minimumLevel = LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.info
const logFormat = process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'json' : 'pretty')

function shouldLog(level) {
  return (LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info) >= minimumLevel
}

function serializeError(error) {
  if (!error) return undefined

  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: error.stack,
  }
}

function formatPretty(entry) {
  if (entry.message === 'http_request_completed') {
    const userId = entry.userId ? ` user=${entry.userId}` : ''
    const origin = entry.origin ? ` origin=${entry.origin}` : ''
    return `${entry.timestamp} ${entry.level.toUpperCase()} ${entry.method} ${entry.path} ${entry.statusCode} ${entry.durationMs}ms ip=${entry.ip}${userId}${origin} requestId=${entry.requestId}`
  }

  const details = { ...entry }
  delete details.timestamp
  delete details.level
  delete details.message
  delete details.service
  delete details.environment

  const hasDetails = Object.keys(details).length > 0
  return `${entry.timestamp} ${entry.level.toUpperCase()} ${entry.message}${hasDetails ? ` ${JSON.stringify(details)}` : ''}`
}

function write(level, message, fields = {}) {
  if (!shouldLog(level)) return

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'url-shortener-api',
    environment: process.env.NODE_ENV || 'development',
    ...fields,
  }

  const line = logFormat === 'pretty' ? formatPretty(entry) : JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
}

export function logError(message, error, fields = {}) {
  logger.error(message, {
    ...fields,
    error: serializeError(error),
  })
}
