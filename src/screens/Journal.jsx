import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/cache'

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 flex gap-3 animate-pulse">
      <div className="w-16 h-16 rounded-lg bg-dark/10 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-dark/10 rounded w-3/4" />
        <div className="h-3 bg-dark/10 rounded w-1/2" />
      </div>
    </div>
  )
}

export default function Journal() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [stats, setStats] = useState({ total: 0, streak: 0, coQuesters: 0 })
  const [sessionReactions, setSessionReactions] = useState({})
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!user) return

    // Check cache before hitting Supabase
    const cached = cacheGet('journal_' + user.id)
    if (cached !== null) {
      setSessions(cached)
      setLoading(false)
    }

    async function fetchJournal() {
      const { data } = await supabase
        .from('quest_sessions')
        .select('id, quest_id, completed_at, photo_url, elapsed_sec, party_ids, quest:quest_id(title, description, xp)')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .range(0, 19)

      const fetched = data || []
      setSessions(fetched)
      setLoading(false)
      if (fetched.length < 20) setHasMore(false)
      cacheSet('journal_' + user.id, fetched, 10 * 60 * 1000)

      // Stats
      const total = fetched.length || 0
      // Unique co-questers across all party_ids
      const allPartyIds = fetched.flatMap(s => s.party_ids || [])
      const uniqueCoQuesters = new Set(allPartyIds).size

      // Fetch streak from users table
      const { data: u } = await supabase.from('users').select('streak').eq('id', user.id).single()
      setStats({ total, streak: u?.streak || 0, coQuesters: uniqueCoQuesters })
    }
    fetchJournal()
  }, [user])

  async function loadMore() {
    if (!user || loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1
    const { data } = await supabase
      .from('quest_sessions')
      .select('id, quest_id, completed_at, photo_url, elapsed_sec, party_ids, quest:quest_id(title, description, xp)')
      .eq('user_id', user.id)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .range(nextPage * 20, nextPage * 20 + 19)

    const fetched = data || []
    setSessions(prev => [...prev, ...fetched])
    setPage(nextPage)
    if (fetched.length < 20) setHasMore(false)
    setLoadingMore(false)
  }

  async function loadReactions(sessionId) {
    const { data } = await supabase
      .from('reactions')
      .select('emoji')
      .eq('session_id', sessionId)

    if (data) {
      const grouped = data.reduce((acc, r) => {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1
        return acc
      }, {})
      setSessionReactions(prev => ({ ...prev, [sessionId]: grouped }))
    }
  }

  return (
    <div className="screen-enter min-h-screen bg-paper flex flex-col pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <button onClick={() => navigate('/home')} className="text-dark/40 text-sm mb-4 block">← Back</button>
        <h1 className="italic text-dark text-4xl" style={{ fontFamily: "'Fraunces', serif" }}>Journal</h1>
      </div>

      {/* Stats row */}
      <div className="px-5 mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'QUESTS', value: stats.total },
          { label: 'STREAK', value: `${stats.streak}d` },
          { label: 'CREW', value: stats.coQuesters },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-3 text-center border border-dark/5">
            <p className="text-dark/40 text-xs mb-1 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
            <p className="text-dark font-bold text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Section label */}
      <p className="px-5 text-dark/40 text-xs tracking-widest uppercase mb-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
        ▾ Recent quests
      </p>

      {/* List */}
      <div className="px-5 flex flex-col gap-3">
        {loading ? (
          [1, 2, 3].map(i => <SkeletonCard key={i} />)
        ) : sessions.length === 0 ? (
          <div className="text-center py-16">
            <p className="italic text-dark/40 text-xl mb-4" style={{ fontFamily: "'Fraunces', serif" }}>
              No memories yet. Your first quest is out there.
            </p>
            <button
              onClick={() => navigate('/home')}
              className="border border-rust text-rust text-sm tracking-widest uppercase px-6 py-2 hover:bg-rust hover:text-white transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              ▲ Drop a quest
            </button>
          </div>
        ) : (
          sessions.map(session => {
            const isExpanded = expandedId === session.id
            return (
              <div key={session.id} className="bg-white rounded-xl overflow-hidden border border-dark/5">
                <button
                  onClick={() => {
                    const nextId = isExpanded ? null : session.id
                    setExpandedId(nextId)
                    if (nextId && !sessionReactions[nextId]) loadReactions(nextId)
                  }}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-dark/10 flex-shrink-0">
                    {session.photo_url ? (
                      <img src={`${session.photo_url}?width=200&quality=60`} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-dark/20 text-2xl">◐</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="italic text-dark font-medium truncate" style={{ fontFamily: "'Fraunces', serif" }}>
                      {session.quest?.title || 'Quest'}
                    </p>
                    <p className="text-dark/40 text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatDate(session.completed_at)} · {formatTime(session.completed_at)}
                    </p>
                    <p className="text-dark/30 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {(session.party_ids || []).length + 1} people
                    </p>
                  </div>
                  <span className="text-dark/30 text-xs ml-2">{isExpanded ? '▴' : '▾'}</span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-dark/5">
                    {session.photo_url && (
                      <img src={`${session.photo_url}?width=800&quality=80`} alt="quest photo" loading="lazy" className="w-full rounded-lg mb-3 mt-3 object-cover" style={{ maxHeight: 280 }} />
                    )}
                    <p className="text-dark/60 text-sm leading-relaxed">
                      {session.quest?.description}
                    </p>
                    {session.elapsed_sec && (
                      <p className="text-dark/30 text-xs mt-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        Completed in {Math.floor(session.elapsed_sec / 60)}:{String(session.elapsed_sec % 60).padStart(2, '0')}
                      </p>
                    )}
                    {Object.keys(sessionReactions[session.id] || {}).length > 0 && (
                      <p className="text-dark/40 text-xs mt-2 font-mono">
                        {Object.entries(sessionReactions[session.id]).map(([emoji, count]) => `${emoji} ${count}`).join('  ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        {!loading && sessions.length > 0 && hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-2 w-full border border-dark/20 text-dark/60 text-xs tracking-widest uppercase py-3 hover:bg-dark/5 transition-colors disabled:opacity-40"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}
