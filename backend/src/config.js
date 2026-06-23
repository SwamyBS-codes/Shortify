import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

export const PORT = Number(process.env.PORT || 3001)
export const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`
export const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:5173`
export const REDIS_URL = process.env.REDIS_URL || ''
export const REDIS_TTL_SECONDS = Number(process.env.REDIS_TTL_SECONDS || 3600)
export const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production'
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
export const RATE_LIMIT_API_MAX = Number(process.env.RATE_LIMIT_API_MAX || 120)
export const RATE_LIMIT_AUTH_MAX = Number(process.env.RATE_LIMIT_AUTH_MAX || 10)
export const RATE_LIMIT_CREATE_LINK_MAX = Number(process.env.RATE_LIMIT_CREATE_LINK_MAX || 20)
export const RATE_LIMIT_PASSWORD_VERIFY_MAX = Number(process.env.RATE_LIMIT_PASSWORD_VERIFY_MAX || 8)
export const RATE_LIMIT_REDIRECT_MAX = Number(process.env.RATE_LIMIT_REDIRECT_MAX || 300)
