import { supabase } from './supabase'

/**
 * Upload a photo blob to Supabase Storage.
 * @param {Blob} blob - The photo blob (jpeg)
 * @param {string} userId - Auth user ID
 * @param {string} sessionId - Quest session ID
 * @param {'main'|'pip'} type - Photo type
 * @returns {Promise<string|null>} Public URL or null on failure
 */
async function attemptUpload(blob, userId, sessionId, type) {
  const path = `${userId}/${sessionId}-${type}.jpg`
  const { error } = await supabase.storage
    .from('quest-photos')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('quest-photos').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadPhoto(blob, userId, sessionId, type = 'main') {
  if (!blob) return null
  try {
    return await attemptUpload(blob, userId, sessionId, type)
  } catch (firstErr) {
    // Retry once after 2 seconds
    await new Promise(r => setTimeout(r, 2000))
    try {
      return await attemptUpload(blob, userId, sessionId, type)
    } catch {
      console.warn('Photo upload failed after retry:', firstErr)
      return null
    }
  }
}

/**
 * Save completion data to the quest_sessions row and upload photos.
 * @param {object} opts
 * @param {string} opts.sessionId
 * @param {string} opts.userId
 * @param {Blob|null} opts.mainPhoto
 * @param {Blob|null} opts.pipPhoto
 * @param {number} opts.elapsedSec
 * @returns {Promise<{mainUrl, pipUrl}>}
 */
export async function completeSession({ sessionId, userId, mainPhoto, pipPhoto, elapsedSec }) {
  const [mainUrl, pipUrl] = await Promise.all([
    mainPhoto ? uploadPhoto(mainPhoto, userId, sessionId, 'main') : Promise.resolve(null),
    pipPhoto ? uploadPhoto(pipPhoto, userId, sessionId, 'pip') : Promise.resolve(null),
  ])

  const { error: updateError } = await supabase.from('quest_sessions').update({
    photo_url: mainUrl,
    pip_photo_url: pipUrl,
    completed_at: new Date().toISOString(),
    elapsed_sec: elapsedSec,
    xp_earned: 100,
  }).eq('id', sessionId)

  if (updateError) console.error('completeSession update failed:', updateError)

  return { mainUrl, pipUrl }
}
