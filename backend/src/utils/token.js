import crypto from 'node:crypto'
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js'

function base64url(input) {
  return Buffer.from(input).toString('base64url')
}

function parseExpiryMs(expiresIn) {
  const match = /^(\d+)([dhms])$/.exec(expiresIn || '7d')
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const value = Number(match[1])
  const unit = match[2]
  const multipliers = { d: 86400000, h: 3600000, m: 60000, s: 1000 }
  return value * multipliers[unit]
}

export function signToken(user) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      sub: String(user.id),
      email: user.email,
      name: user.name,
      exp: Math.floor((Date.now() + parseExpiryMs(JWT_EXPIRES_IN)) / 1000),
    }),
  )
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')
  return `${header}.${payload}.${signature}`
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, payload, signature] = parts
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url')

  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length) return null
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}
