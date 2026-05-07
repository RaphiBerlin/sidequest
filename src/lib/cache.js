const PREFIX = 'sq_cache_'

export function cacheSet(key, data, ttlMs) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({
      data,
      expiresAt: Date.now() + ttlMs
    }))
  } catch (e) {
    // localStorage full or unavailable — fail silently
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data, expiresAt } = JSON.parse(raw)
    if (Date.now() > expiresAt) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function cacheClear(key) {
  localStorage.removeItem(PREFIX + key)
}
