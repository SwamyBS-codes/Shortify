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