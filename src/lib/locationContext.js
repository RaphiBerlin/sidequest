import { cacheGet, cacheSet } from './cache'

export async function getLocationContext(lat, lng) {
  const cacheKey = `location_context_${Math.round(lat * 100)}_${Math.round(lng * 100)}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    )
    const data = await res.json()

    const display = (data.display_name || '').toLowerCase()
    const addr = data.address || {}
    const contexts = ['universal']

    if (/beach|coast|harbour|bay|pier|marina|seafront/.test(display)) contexts.push('water')
    if (/park|garden|forest|reserve|common|wood/.test(display)) { contexts.push('park'); contexts.push('nature') }
    if (addr.city || addr.town) { contexts.push('urban'); contexts.push('commercial') }
    if (addr.village || addr.suburb || addr.neighbourhood) contexts.push('suburban')

    const label = addr.neighbourhood || addr.suburb || addr.quarter || addr.city || addr.town || addr.village || 'your area'

    const result = { contexts, label }
    cacheSet(cacheKey, result, 60 * 60 * 1000) // 1 hour TTL
    return result
  } catch {
    return { contexts: ['universal'], label: 'your area' }
  }
}
