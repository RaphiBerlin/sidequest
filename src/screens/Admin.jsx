import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [activeQuest, setActiveQuest] = useState(null)
  const [quests, setQuests] = useState([])
  const [users, setUsers] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [dropping, setDropping] = useState(false)
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.email === import.meta.env.VITE_ADMIN_EMAIL

  useEffect(() => {
    if (!isAdmin) return
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [isAdmin])

  async function fetchData() {
    // Active quest
    const { data: aq } = await supabase
      .from('active_quest')
      .select('*, quest:quests(title)')
      .order('dropped_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveQuest(aq)

    // All quests for picker
    const { data: q } = await supabase.from('quests').select('id, title').order('title')
    setQuests(q || [])

    // Users with session count
    const { data: u } = await supabase
      .from('users')
      .select('id, name, email, streak, created_at')
      .order('created_at', { ascending: false })
    setUsers(u || [])

    // Recent sessions
    const { data: s } = await supabase
      .from('quest_sessions')
      .select('id, completed_at, photo_url, party_ids, user:users(name), quest:quests(title)')
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(20)
    setRecentSessions(s || [])

    setLoading(false)
  }

  async function dropQuest() {
    setDropping(true)
    await supabase.functions.invoke('drop-quest', {
      body: selectedQuestId ? { quest_id: selectedQuestId } : {},
    })
    await fetchData()
    setDropping(false)
  }

  function timeRemaining(expiresAt) {
    const diff = new Date(expiresAt) - Date.now()
    if (diff <= 0) return 'Expired'
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${m}m ${s}s`
  }

  if (!user) return null
  if (!isAdmin) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-paper/40 font-mono text-sm">Access denied.</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-dark text-paper p-6" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-rust italic text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>Admin</h1>
          <p className="text-paper/40 text-xs font-mono">{user.email}</p>
        </div>
        <button onClick={signOut} className="text-paper/40 text-xs font-mono border border-paper/20 px-3 py-1 hover:border-rust hover:text-rust transition-colors">
          Sign out
        </button>
      </div>

      {/* Quest Controls */}
      <section className="mb-8">
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Quest Controls</h2>
        <div className="bg-paper/5 rounded-xl p-4 border border-paper/10 mb-3">
          {activeQuest ? (
            <div>
              <p className="text-paper text-sm font-medium">{activeQuest.quest?.title}</p>
              <p className="text-paper/40 text-xs font-mono mt-1">
                Dropped: {new Date(activeQuest.dropped_at).toLocaleTimeString()} ·
                Expires in: {timeRemaining(activeQuest.expires_at)}
              </p>
            </div>
          ) : (
            <p className="text-paper/40 text-sm font-mono">No active quest</p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={selectedQuestId}
            onChange={e => setSelectedQuestId(e.target.value)}
            className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none"
          >
            <option value="">Random quest</option>
            {quests.map(q => (
              <option key={q.id} value={q.id}>{q.title}</option>
            ))}
          </select>
          <button
            onClick={dropQuest}
            disabled={dropping}
            className="bg-rust text-dark text-xs font-mono px-4 py-2 tracking-widest uppercase disabled:opacity-50 whitespace-nowrap"
          >
            {dropping ? 'Dropping…' : 'Drop now'}
          </button>
        </div>
      </section>

      {/* Users table */}
      <section className="mb-8">
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-paper/40 border-b border-paper/10">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Email</th>
                <th className="text-left py-2 pr-4">Streak</th>
                <th className="text-left py-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-paper/5 hover:bg-paper/5">
                  <td className="py-2 pr-4 text-paper">{u.name || '—'}</td>
                  <td className="py-2 pr-4 text-paper/60">{u.email}</td>
                  <td className="py-2 pr-4 text-rust">🔥 {u.streak}</td>
                  <td className="py-2 text-paper/40">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Recent Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-paper/40 border-b border-paper/10">
                <th className="text-left py-2 pr-4">User</th>
                <th className="text-left py-2 pr-4">Quest</th>
                <th className="text-left py-2 pr-4">Completed</th>
                <th className="text-left py-2 pr-4">Party</th>
                <th className="text-left py-2">Photo</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map(s => (
                <tr key={s.id} className="border-b border-paper/5 hover:bg-paper/5">
                  <td className="py-2 pr-4 text-paper">{s.user?.name || '—'}</td>
                  <td className="py-2 pr-4 text-paper/60 max-w-[200px] truncate">{s.quest?.title || '—'}</td>
                  <td className="py-2 pr-4 text-paper/40">{new Date(s.completed_at).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-paper/60">{(s.party_ids?.length || 0) + 1}</td>
                  <td className="py-2 text-green-400">{s.photo_url ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
