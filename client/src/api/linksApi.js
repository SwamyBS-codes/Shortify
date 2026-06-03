import httpClient from './httpClient'

function toUiLink(row) {
  return {
    id: row.id,
    title: new URL(row.original_url).hostname.replace(/^www\./, ''),
    longUrl: row.original_url,
    shortUrl: row.short_url,
    code: row.code || row.short_code,
    clicks: row.clicks,
    createdAt: new Date(row.created_at).toLocaleString(),
    customAlias: row.custom_alias || null,
    passwordProtected: Boolean(row.is_password_protected),
    expiresAt: row.expires_at ? new Date(row.expires_at).toLocaleString() : null,
    expirationType: row.expiration_type || 'none',
    isActive: row.is_active !== false,
    status: row.is_active === false ? 'Disabled' : row.expires_at && new Date(row.expires_at) < new Date() ? 'Expired' : row.is_password_protected ? 'Password protected' : 'Active',
  }
}

function parseAxiosError(error) {
  return error?.response?.data?.error || error.message || 'Request failed'
}

export async function fetchAllLinks() {
  try {
    const { data } = await httpClient.get('/listAllLinks')
    return Array.isArray(data.links) ? data.links.map(toUiLink) : []
  } catch (error) {
    throw new Error(parseAxiosError(error))
  }
}

export async function createLink(payload) {
  let data
  try {
    const response = await httpClient.post('/createlink', payload)
    data = response.data
  } catch (error) {
    throw new Error(parseAxiosError(error))
  }

  return {
    id: data.id,
    title: new URL(data.original_url).hostname.replace(/^www\./, ''),
    longUrl: data.original_url,
    shortUrl: data.short_url,
    code: data.code || data.short_code,
    clicks: data.clicks,
    createdAt: new Date(data.created_at).toLocaleString(),
    customAlias: data.custom_alias || null,
    passwordProtected: Boolean(data.is_password_protected),
    expiresAt: data.expires_at ? new Date(data.expires_at).toLocaleString() : null,
    expirationType: data.expiration_type || 'none',
    isActive: data.is_active !== false,
    status: data.is_active === false ? 'Disabled' : data.expires_at && new Date(data.expires_at) < new Date() ? 'Expired' : data.is_password_protected ? 'Password protected' : 'Active',
  }
}

export async function fetchDashboardSummary() {
  try {
    const { data } = await httpClient.get('/dashboard')
    return data
  } catch (error) {
    throw new Error(parseAxiosError(error))
  }
}
