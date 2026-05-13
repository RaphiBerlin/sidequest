/**
 * Admin Moderation — banned words + photo review
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { invalidateBannedWordsCache } from '../../lib/moderation'

const TABS = ['Photos', 'Banned Users', 'Banned Words']

export default function AdminModeration() {
  const [tab, setTab] = useState('Photos')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase">Moderation</h2>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-paper/10 mb-6">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-mono tracking-widest uppercase px-4 py-2 border-b-2 transition-colors ${
              tab === t
                ? 'border-rust text-rust'
                : 'border-transparent text-paper/40 hover:text-paper/60'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Photos'       && <PhotoReview />}
      {tab === 'Banned Users' && <BannedUsers />}
      {tab === 'Banned Words' && <BannedWords />}
    </div>
  )
}

// ── Photo Review ───────────────────────────────────────────────────────────

function storagePathFromUrl(url) {
  try {
    const marker = '/quest-photos/'
    const idx = url.indexOf(marker)
    return idx !== -1 ? url.slice(idx + marker.length) : null
  } catch {
    return null
  }
}

function relTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function PhotoCard({ photo, onDeleted }) {
  const [acting, setActing] = useState(null)
  const [done, setDone] = useState(false)
  const [lightbox, setLightbox] = useState(false)

  async function deletePhoto() {
    // Delete storage files first
    const mainPath = storagePathFromUrl(photo.photo_url)
    if (mainPath) await supabase.storage.from('quest-photos').remove([mainPath])
    if (photo.pip_photo_url) {
      const pipPath = storagePathFromUrl(photo.pip_photo_url)
      if (pipPath) await supabase.storage.from('quest-photos').remove([pipPath])
    }
    // Delete the entire session row — removes it from the user's history
    await supabase.from('quest_sessions').delete().eq('id', photo.id)
  }

  async function banUser() {
    await supabase.from('users').update({ is_banned: true }).eq('id', photo.user_id)
  }

  async function handle(action) {
    setActing(action)
    try {
      if (action === 'delete' || action === 'both') await deletePhoto()
      if (action === 'ban'    || action === 'both') await banUser()
      setDone(true)
      onDeleted(photo.id)
    } finally {
      setActing(null)
    }
  }

  if (done) return null

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-dark/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(false)}
        >
          <img
            src={photo.photo_url}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-paper/40 text-2xl hover:text-paper/80 transition-colors"
          >×</button>
        </div>
      )}

      <div className="bg-paper/5 border border-paper/10 rounded-xl overflow-hidden flex flex-col">
        <div className="relative cursor-zoom-in" onClick={() => setLightbox(true)}>
          <img
            src={photo.photo_url}
            alt="Quest photo"
            className="w-full aspect-square object-cover"
            loading="lazy"
          />
          {photo.pip_photo_url && (
            <img
              src={photo.pip_photo_url}
              alt="PiP"
              className="absolute bottom-2 right-2 w-14 h-14 object-cover rounded-lg border-2 border-dark"
            />
          )}
        </div>

        <div className="p-3 flex-1 flex flex-col gap-2">
          <div>
            <p className="text-paper text-xs font-mono truncate">{photo.user?.name ?? 'Unknown'}</p>
            <p className="text-paper/40 text-[10px] font-mono truncate">{photo.quest?.title}</p>
            <p className="text-paper/25 text-[10px] font-mono mt-0.5">{relTime(photo.completed_at)}</p>
          </div>

          <div className="flex flex-col gap-1.5 mt-auto pt-2 border-t border-paper/10">
            <button
              onClick={() => handle('delete')}
              disabled={!!acting}
              className="w-full text-[10px] font-mono tracking-widest uppercase py-1.5 border border-red-500/30 text-red-400/70 hover:border-red-500/60 hover:text-red-400 transition-colors disabled:opacity-40 rounded"
            >
              {acting === 'delete' ? '…' : 'Delete photo'}
            </button>
            <button
              onClick={() => handle('ban')}
              disabled={!!acting}
              className="w-full text-[10px] font-mono tracking-widest uppercase py-1.5 border border-paper/20 text-paper/40 hover:border-paper/40 hover:text-paper/60 transition-colors disabled:opacity-40 rounded"
            >
              {acting === 'ban' ? '…' : 'Ban user'}
            </button>
            <button
              onClick={() => handle('both')}
              disabled={!!acting}
              className="w-full text-[10px] font-mono tracking-widest uppercase py-1.5 bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40 rounded"
            >
              {acting === 'both' ? '…' : 'Delete + Ban'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function PhotoReview() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('quest_sessions')
      .select('id, user_id, completed_at, photo_url, pip_photo_url, user:users(name), quest:quests(title)')
      .not('photo_url', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(200)
    setPhotos(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  function handleDeleted(sessionId) {
    setPhotos(prev => prev.filter(p => p.id !== sessionId))
  }

  if (loading) return <p className="text-paper/30 text-xs font-mono py-4">Loading…</p>

  if (!photos.length) return (
    <p className="text-paper/30 text-xs font-mono py-4">No photos uploaded yet.</p>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-paper/30 text-[10px] font-mono">
          {photos.length} photo{photos.length !== 1 ? 's' : ''} · click to enlarge
        </p>
        <button
          onClick={fetchPhotos}
          className="text-paper/40 text-xs font-mono border border-paper/20 px-3 py-1 hover:border-paper/40 hover:text-paper/60 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map(p => (
          <PhotoCard key={p.id} photo={p} onDeleted={handleDeleted} />
        ))}
      </div>
    </div>
  )
}

// ── Banned Users ───────────────────────────────────────────────────────────

function BannedUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [unbanning, setUnbanning] = useState(null)

  useEffect(() => { fetchBanned() }, [])

  async function fetchBanned() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('id, name, email, streak, created_at')
      .eq('is_banned', true)
      .order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function unban(id) {
    setUnbanning(id)
    await supabase.from('users').update({ is_banned: false }).eq('id', id)
    setUsers(prev => prev.filter(u => u.id !== id))
    setUnbanning(null)
  }

  if (loading) return <p className="text-paper/30 text-xs font-mono py-4">Loading…</p>

  if (!users.length) return (
    <div className="bg-paper/5 border border-paper/10 rounded-xl p-6 text-center">
      <p className="text-paper/30 text-xs font-mono">No banned users.</p>
    </div>
  )

  return (
    <div>
      <p className="text-paper/30 text-xs font-mono mb-4">
        {users.length} banned user{users.length !== 1 ? 's' : ''}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-paper/40 border-b border-paper/10">
              <th className="text-left py-2 pr-4">Name</th>
              <th className="text-left py-2 pr-4">Email</th>
              <th className="text-left py-2 pr-4">Streak</th>
              <th className="text-left py-2 pr-4">Joined</th>
              <th className="text-left py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-paper/5 hover:bg-paper/5">
                <td className="py-2.5 pr-4 text-paper">{u.name || '—'}</td>
                <td className="py-2.5 pr-4 text-paper/50">{u.email}</td>
                <td className="py-2.5 pr-4 text-rust">🔥 {u.streak}</td>
                <td className="py-2.5 pr-4 text-paper/40">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-2.5">
                  <button
                    onClick={() => unban(u.id)}
                    disabled={unbanning === u.id}
                    className="px-2 py-0.5 border border-green-500/40 text-green-400 hover:bg-green-500/10 transition-colors disabled:opacity-40"
                  >
                    {unbanning === u.id ? '…' : 'Unban'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Banned Words ───────────────────────────────────────────────────────────

function BannedWords() {
  const [words, setWords] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => { fetchWords() }, [])

  async function fetchWords() {
    setLoading(true)
    const { data } = await supabase
      .from('banned_words')
      .select('id, word, created_at')
      .order('word', { ascending: true })
    setWords(data || [])
    setLoading(false)
  }

  async function addWord(e) {
    e.preventDefault()
    const word = input.trim().toLowerCase()
    if (!word) return
    setAdding(true)
    setError('')
    const { error } = await supabase.from('banned_words').insert({ word })
    if (error) {
      setError(error.code === '23505' ? `"${word}" is already in the list.` : error.message)
    } else {
      setInput('')
      invalidateBannedWordsCache()
      await fetchWords()
    }
    setAdding(false)
  }

  async function addMultiple(rawList) {
    const toAdd = rawList
      .split(/[\n,]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0)
    if (!toAdd.length) return
    setAdding(true)
    setError('')
    const { error } = await supabase.from('banned_words').insert(toAdd.map(word => ({ word }))).select()
    if (error && error.code !== '23505') setError(error.message)
    invalidateBannedWordsCache()
    await fetchWords()
    setAdding(false)
  }

  async function removeWord(id) {
    setRemoving(id)
    await supabase.from('banned_words').delete().eq('id', id)
    invalidateBannedWordsCache()
    setWords(prev => prev.filter(w => w.id !== id))
    setRemoving(null)
  }

  const filtered = filter
    ? words.filter(w => w.word.includes(filter.toLowerCase()))
    : words

  return (
    <div>
      <p className="text-paper/30 text-xs font-mono mb-5">
        {words.length} word{words.length !== 1 ? 's' : ''} · case-insensitive substring match on all user text
      </p>

      <form onSubmit={addWord} className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a word…"
          maxLength={80}
          className="flex-1 bg-paper/5 border border-paper/20 rounded-lg px-3 py-2 text-paper text-sm font-mono placeholder-paper/20 outline-none focus:border-paper/40 transition-colors"
        />
        <button
          type="submit"
          disabled={adding || !input.trim()}
          className="border border-rust text-rust px-4 py-2 text-xs font-mono tracking-widest uppercase hover:bg-rust/10 transition-colors disabled:opacity-40"
        >
          {adding ? '…' : 'Add'}
        </button>
      </form>

      <details className="mb-5">
        <summary className="text-paper/30 text-xs font-mono cursor-pointer hover:text-paper/50 transition-colors select-none mb-2">
          ▸ Bulk add (comma- or line-separated)
        </summary>
        <BulkAdd onAdd={addMultiple} adding={adding} />
      </details>

      {error && <p className="text-red-400 text-xs font-mono mb-4">{error}</p>}

      {words.length > 10 && (
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter list…"
          className="w-full bg-paper/5 border border-paper/10 rounded-lg px-3 py-2 text-paper text-xs font-mono placeholder-paper/20 outline-none focus:border-paper/30 transition-colors mb-4"
        />
      )}

      {loading ? (
        <p className="text-paper/30 text-xs font-mono py-4">Loading…</p>
      ) : words.length === 0 ? (
        <div className="bg-paper/5 border border-paper/10 rounded-xl p-6 text-center">
          <p className="text-paper/30 text-xs font-mono">No banned words yet.</p>
          <p className="text-paper/20 text-xs font-mono mt-1">Add words above to start filtering user content.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {filtered.map(w => (
            <div key={w.id} className="flex items-center justify-between bg-paper/5 border border-paper/10 rounded-lg px-3 py-2 gap-2">
              <span className="text-paper/70 text-xs font-mono truncate">{w.word}</span>
              <button
                onClick={() => removeWord(w.id)}
                disabled={removing === w.id}
                className="text-paper/20 hover:text-red-400 transition-colors flex-shrink-0 text-sm leading-none disabled:opacity-40"
              >
                {removing === w.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}

      {filter && filtered.length === 0 && (
        <p className="text-paper/30 text-xs font-mono py-4">No words match "{filter}".</p>
      )}
    </div>
  )
}

function BulkAdd({ onAdd, adding }) {
  const [text, setText] = useState('')
  function handleSubmit(e) {
    e.preventDefault()
    onAdd(text)
    setText('')
  }
  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder={"word1, word2, word3\nor one per line"}
        className="w-full bg-paper/5 border border-paper/20 rounded-lg px-3 py-2 text-paper text-xs font-mono placeholder-paper/20 outline-none focus:border-paper/40 transition-colors resize-none"
      />
      <button
        type="submit"
        disabled={adding || !text.trim()}
        className="self-start border border-rust/60 text-rust px-4 py-1.5 text-xs font-mono tracking-widest uppercase hover:bg-rust/10 transition-colors disabled:opacity-40"
      >
        {adding ? 'Adding…' : 'Add all'}
      </button>
    </form>
  )
}
