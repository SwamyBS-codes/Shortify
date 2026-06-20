import dotenv from 'dotenv'
import postgres from 'postgres'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const connectionString = process.env.DATABASE_URL?.trim()
const useConnectionString = Boolean(connectionString)
const user = process.env.DB_USER
const password = process.env.DB_PASSWORD
const host = process.env.DB_HOST
const port = Number(process.env.DB_PORT || 5432)
const database = process.env.DB_NAME

if (!useConnectionString && (!user || !password || !host || !database)) {
  throw new Error('Database config is missing. Set DATABASE_URL or DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME in .env')
}

const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false

const postgresOptions = {
  onnotice: () => {},
}

function parseDatabaseUrl(urlString) {
  const url = new URL(urlString)
  const dbName = url.pathname?.slice(1)

  return {
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port || 5432),
    database: dbName,
    ssl: sslConfig,
    ...postgresOptions,
  }
}

const postgresPool = postgres(useConnectionString ? parseDatabaseUrl(connectionString) : {
  username: user,
  password,
  host,
  port,
  database,
  ssl: sslConfig,
  ...postgresOptions,
})

export default postgresPool
export { postgresPool }
