const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
const minimumLevel = LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.info

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

  const line = JSON.stringify(entry)
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
