/**
 * Client-side moderation helpers.
 * Fetches the banned_words list from the DB (cached for 5 min),
 * then checks any text for substring matches.
 */
import { supabase } from './supabase'

let _cache = null
let _cacheAt = 0
const TTL = 5 * 60 * 1000 // 5 minutes

export async function getBannedWords() {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache
  const { data } = await supabase.from('banned_words').select('word')
  _cache = (data || []).map(r => r.word.toLowerCase().trim()).filter(Boolean)
  _cacheAt = Date.now()
  return _cache
}

/** Call this after adding/removing words in the admin so the cache is fresh. */
export function invalidateBannedWordsCache() {
  _cache = null
  _cacheAt = 0
}

/**
 * Returns the matched banned word if found, or null if the text is clean.
 * Case-insensitive substring match.
 */
export async function checkText(text) {
  if (!text?.trim()) return null
  const words = await getBannedWords()
  const lower = text.toLowerCase()
  return words.find(w => lower.includes(w)) ?? null
}
