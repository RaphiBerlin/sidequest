/**
 * Normalise a colour value — add leading # to bare hex strings like 'C44829'.
 */
function normaliseColor(c) {
  if (!c) return '#c44829'
  if (/^[0-9a-fA-F]{3,6}$/.test(c.trim())) return '#' + c.trim()
  return c
}

/**
 * Derive display initials from a full name.
 * "Raphi Berlin" → "RB", "Raphi" → "R", "" → "?"
 */
function initials(name) {
  if (!name || !name.trim()) return '?'
  // Strip email domain so "user@example.com" doesn't produce "U@" etc.
  const cleaned = name.includes('@') ? name.split('@')[0] : name
  const parts = cleaned.trim().split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Shared avatar component.
 * Shows a profile photo if available; otherwise shows initials
 * on a coloured background (avatar_color or default rust).
 */
export default function Avatar({ src, name, color, size = 40 }) {
  const letters = initials(name)
  const bg = normaliseColor(color)
  // Two-char initials need slightly smaller text to fit comfortably
  const fontSize = Math.round(size * (letters.length > 1 ? 0.33 : 0.4))

  if (src) {
    return (
      <div
        className="rounded-full overflow-hidden flex-shrink-0 bg-dark/10"
        style={{ width: size, height: size, minWidth: size }}
      >
        <img
          src={src}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 italic select-none"
      style={{
        width: size,
        height: size,
        minWidth: size,
        backgroundColor: bg,
        color: '#f4ede0',
        fontSize,
        fontFamily: "'Fraunces', serif",
      }}
    >
      {letters}
    </div>
  )
}
