const MAX_STORED_W = 1440

/**
 * Returns a Supabase Storage transform URL sized for the actual screen pixels.
 * cssWidth  — the rendered CSS width of the element in logical pixels
 * quality   — JPEG quality (0–100), default 90
 *
 * On a 3× device a 320px card requests 960px — crisp without over-fetching.
 * Capped at MAX_STORED_W so we never ask for more than what's stored.
 */
export function photoUrl(base, cssWidth, quality = 90) {
  if (!base || base.startsWith('blob:') || base.startsWith('data:')) return base
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1
  const w = Math.min(Math.round(cssWidth * dpr), MAX_STORED_W)
  const clean = base.split('?')[0]
  return `${clean}?width=${w}&quality=${quality}`
}
