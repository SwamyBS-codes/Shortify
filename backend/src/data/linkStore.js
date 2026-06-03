import postgresPool from '../db.js'

export const listLinks = async (req, res) => {
  try {
    const links = await getAllLinksData()
    res.send({ success: true, links })
  } catch (error) {
    console.error('Error fetching links:', error)
    res.status(500).json({ error: 'Failed to fetch links' })
  }
}

export const getLinkByCode = async (req, res) => {
  try {
    const { code } = req.params
    const linkByCode = await queryUrlByShortCode(code)
    res.send({ success: true, link: linkByCode })
  } catch (error) {
    console.error('Error fetching link by code:', error)
    res.status(500).json({ error: 'Failed to fetch link' })
  }
}

export async function addUrl(record) {
  try {
    const {
      original_url,
      short_code,
      custom_alias,
      title,
      password_hash,
      is_password_protected,
      expiration_type,
      expires_at,
    } = record

    const result = await postgresPool`
      insert into urls (
        original_url,
        short_code,
        custom_alias,
        title,
        password_hash,
        is_password_protected,
        expiration_type,
        expires_at
      ) values (
        ${original_url},
        ${short_code},
        ${custom_alias},
        ${title},
        ${password_hash},
        ${is_password_protected},
        ${expiration_type},
        ${expires_at}
      ) returning *
    `

    return result[0]
  } catch (error) {
    console.error('Error adding url:', error)
    throw error
  }
}

export async function checkCodeExists(code) {
  try {
    const result = await postgresPool`
      select 1 from urls where short_code = ${code} limit 1
    `
    return result.length > 0
  } catch (error) {
    console.error('Error checking code exists:', error)
    throw error
  }
}

export async function queryUrlByShortCode(shortCode) {
  try {
    const result = await postgresPool`
      select * from urls where short_code = ${shortCode} limit 1
    `

    if (result.length === 0) {
      throw new Error(`Short link with code '${shortCode}' not found`)
    }

    return result[0]
  } catch (error) {
    console.error('Error querying url by short code:', error)
    throw error
  }
}

export async function queryUrlByOriginalUrl(originalUrl) {
  try {
    const result = await postgresPool`
      select * from urls where original_url = ${originalUrl} order by created_at desc limit 1
    `
    return result[0] || null
  } catch (error) {
    console.error('Error querying url by original URL:', error)
    throw error
  }
}

export async function incrementClicks(code) {
  try {
    const result = await postgresPool`
      update urls
      set click_count = click_count + 1,
          updated_at = now()
      where short_code = ${code}
      returning click_count
    `
    if (result.length === 0) {
      throw new Error(`Short link with code '${code}' not found`)
    }
    return result[0].click_count
  } catch (error) {
    console.error('Error incrementing clicks:', error)
    throw error
  }
}

export async function recordVisit(urlId, visit) {
  try {
    const { ip_address, country, device, browser, os, referrer } = visit
    await postgresPool`
      insert into url_visits (
        url_id,
        ip_address,
        country,
        device,
        browser,
        os,
        referrer
      ) values (
        ${urlId},
        ${ip_address},
        ${country},
        ${device},
        ${browser},
        ${os},
        ${referrer}
      )
    `
  } catch (error) {
    console.error('Error recording visit:', error)
    throw error
  }
}

export async function getDashboardStats() {
  try {
    const stats = await postgresPool`
      select
        count(*)::int as total_links,
        coalesce(sum(click_count), 0)::int as total_clicks,
        coalesce(max(click_count), 0)::int as max_clicks,
        coalesce(avg(click_count), 0)::float as avg_clicks,
        count(*) filter (where is_password_protected) as protected_links
      from urls
    `
    return stats[0]
  } catch (error) {
    console.error('Error getting dashboard stats:', error)
    throw error
  }
}

export async function getRecentLinks(limit = 10) {
  try {
    const result = await postgresPool`
      select * from urls order by created_at desc limit ${limit}
    `
    return result
  } catch (error) {
    console.error('Error getting recent links:', error)
    throw error
  }
}

export async function getAllLinksData() {
  try {
    return await postgresPool`select * from urls order by created_at desc`
  } catch (error) {
    console.error('Error fetching all links data:', error)
    throw error
  }
}

export async function getLinkAnalytics(shortCode) {
  try {
    const [url] = await postgresPool`
      select id, short_code, original_url, click_count, created_at, updated_at, expires_at, is_password_protected
      from urls
      where short_code = ${shortCode}
      limit 1
    `

    if (!url) {
      throw new Error(`Short link with code '${shortCode}' not found`)
    }

    const visits = await postgresPool`
      select ip_address, country, device, browser, os, referrer, visited_at
      from url_visits
      where url_id = ${url.id}
      order by visited_at desc
      limit 50
    `

    return { url, visits }
  } catch (error) {
    console.error('Error fetching link analytics:', error)
    throw error
  }
}
