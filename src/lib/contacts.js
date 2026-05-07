export function contactsSupported() {
  return 'contacts' in navigator && 'ContactsManager' in window
}

export async function getContactPhones() {
  const contacts = await navigator.contacts.select(['tel'], { multiple: true })
  const phones = []
  for (const c of contacts) {
    for (const tel of (c.tel || [])) {
      phones.push(tel)
    }
  }
  return phones
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length > 7) return '+' + digits
  return null
}

async function sha256hex(str) {
  const data = new TextEncoder().encode(str)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashContactPhones(phones) {
  const results = await Promise.all(
    phones.map(async (raw) => {
      const normalized = normalizePhone(raw)
      if (!normalized) return null
      const hash = await sha256hex(normalized)
      return hash
    })
  )
  return [...new Set(results.filter(Boolean))]
}
