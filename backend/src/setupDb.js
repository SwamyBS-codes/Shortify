import postgresPool from './db.js'
import { pathToFileURL } from 'node:url'
import { logger, logError } from './utils/logger.js'

export async function setupDatabase() {
  await postgresPool`
    create table if not exists users (
      id bigserial primary key,
      name text,
      email text unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    )
  `

  await postgresPool`
    create table if not exists urls (
      id bigserial primary key,
      original_url text not null,
      short_code text not null unique,
      custom_alias text unique,
      title text,
      password_hash text,
      is_password_protected boolean not null default false,
      expiration_type text,
      expires_at timestamptz,
      click_count integer not null default 0,
      is_active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `

  await postgresPool`
    create table if not exists url_visits (
      id bigserial primary key,
      url_id bigint not null references urls(id) on delete cascade,
      ip_address text,
      country text,
      device text,
      browser text,
      os text,
      referrer text,
      visited_at timestamptz not null default now()
    )
  `

  await postgresPool`
    create unique index if not exists urls_custom_alias_unique on urls (custom_alias)
  `

  await postgresPool`
    create unique index if not exists urls_short_code_unique on urls (short_code)
  `

  await postgresPool`
    create index if not exists url_visits_url_id_idx on url_visits (url_id)
  `

  await postgresPool`
    alter table urls add column if not exists user_id bigint references users(id) on delete set null
  `

  await postgresPool`
    alter table urls add column if not exists starts_at timestamptz
  `

  await postgresPool`
    alter table urls add column if not exists folder text
  `

  await postgresPool`
    alter table urls add column if not exists tags text[] not null default '{}'
  `

  await postgresPool`
    create index if not exists urls_user_id_idx on urls (user_id)
  `

  await postgresPool`
    create index if not exists urls_folder_idx on urls (folder) where folder is not null
  `

  logger.info('database_schema_ready')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  setupDatabase()
    .then(async () => {
      await postgresPool.end()
    })
    .catch(async (error) => {
      logError('database_schema_setup_failed', error)
      await postgresPool.end()
      process.exit(1)
    })
}
