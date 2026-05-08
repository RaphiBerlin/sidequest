import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function Admin() {
  const { user, signOut } = useAuth()
  const [activeQuest, setActiveQuest] = useState(null)
  const [quests, setQuests] = useState([])
  const [users, setUsers] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [dropping, setDropping] = useState(false)
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCreateQuest, setShowCreateQuest] = useState(false)
  const [newQuest, setNewQuest] = useState({ title: '', description: '', duration_min: 45 })
  const [creating, setCreating] = useState(false)
  const [editingQuestId, setEditingQuestId] = useState(null)
  const [editQuest, setEditQuest] = useState({})
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(null)

  useEffect(() => {
    if (!user) return
    // Check admin: env email OR is_admin flag in DB
    const envAdmin = user.email === import.meta.env.VITE_ADMIN_EMAIL
    if (envAdmin) { setIsAdmin(true); return }
    supabase.from('users').select('is_admin').eq('id', user.id).single()
      .then(({ data }) => { if (data?.is_admin) setIsAdmin(true) })
  }, [user])

  useEffect(() => {
    if (!isAdmin) return
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [isAdmin])

  async function fetchData() {
    const [aq, q, u, s] = await Promise.all([
      supabase.from('active_quest').select('*, quest:quests(title)').order('dropped_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('quests').select('id, title, description, duration_min').order('title'),
      supabase.from('users').select('id, name, email, streak, is_admin, created_at').order('created_at', { ascending: false }),
      supabase.from('quest_sessions').select('id, completed_at, photo_url, party_ids, user:users(name), quest:quests(title)').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(20),
    ])
    setActiveQuest(aq.data)
    setQuests(q.data || [])
    setUsers(u.data || [])
    setRecentSessions(s.data || [])
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

  async function createQuest() {
    if (!newQuest.title.trim()) return
    setCreating(true)
    await supabase.from('quests').insert({
      title: newQuest.title.trim(),
      description: newQuest.description.trim(),
      duration_min: Number(newQuest.duration_min) || 45,
    })
    setNewQuest({ title: '', description: '', duration_min: 45 })
    setShowCreateQuest(false)
    await fetchData()
    setCreating(false)
  }

  async function saveQuest(id) {
    setSaving(true)
    await supabase.from('quests').update({
      title: editQuest.title.trim(),
      description: editQuest.description.trim(),
      duration_min: Number(editQuest.duration_min) || 45,
    }).eq('id', id)
    setEditingQuestId(null)
    await fetchData()
    setSaving(false)
  }

  async function toggleAdmin(userId, current) {
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId)
    await fetchData()
  }

  async function seedSessions(userId) {
    setSeeding(userId)
    try {
      const { error } = await supabase.functions.invoke('admin-seed', { body: { user_id: userId } })
      if (error) alert('Seed failed: ' + error.message)
      else await fetchData()
    } finally {
      setSeeding(null)
    }
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
                Dropped: {new Date(activeQuest.dropped_at).toLocaleTimeString()} · Expires in: {timeRemaining(activeQuest.expires_at)}
              </p>
            </div>
          ) : (
            <p className="text-paper/40 text-sm font-mono">No active quest</p>
          )}
        </div>

        <div className="flex gap-2 items-center mb-4">
          <select
            value={selectedQuestId}
            onChange={e => setSelectedQuestId(e.target.value)}
            className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none"
          >
            <option value="">Random quest</option>
            {quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          <button onClick={dropQuest} disabled={dropping}
            className="bg-rust text-dark text-xs font-mono px-4 py-2 tracking-widest uppercase disabled:opacity-50 whitespace-nowrap">
            {dropping ? 'Dropping…' : 'Drop now'}
          </button>
        </div>

        {/* Quest list header */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-paper/40 text-xs font-mono">All quests ({quests.length})</p>
          <button onClick={() => setShowCreateQuest(v => !v)}
            className="text-xs font-mono border border-paper/20 px-3 py-1 text-paper/60 hover:border-gold hover:text-gold transition-colors">
            {showCreateQuest ? 'Cancel' : '+ New quest'}
          </button>
        </div>

        {/* Create form */}
        {showCreateQuest && (
          <div className="bg-paper/5 rounded-xl p-4 border border-paper/10 mb-3 flex flex-col gap-3">
            <input placeholder="Quest title" value={newQuest.title}
              onChange={e => setNewQuest(p => ({ ...p, title: e.target.value }))}
              className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none placeholder-paper/30" />
            <textarea placeholder="Description (optional)" value={newQuest.description}
              onChange={e => setNewQuest(p => ({ ...p, description: e.target.value }))}
              rows={2} className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none placeholder-paper/30 resize-none" />
            <div className="flex items-center gap-3">
              <input type="number" placeholder="Duration (min)" value={newQuest.duration_min}
                onChange={e => setNewQuest(p => ({ ...p, duration_min: e.target.value }))}
                className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none w-32" />
              <button onClick={createQuest} disabled={creating || !newQuest.title.trim()}
                className="ml-auto bg-gold text-dark text-xs font-mono px-4 py-1.5 tracking-widest uppercase disabled:opacity-50">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Quest list */}
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {quests.map(q => (
            <div key={q.id}>
              {editingQuestId === q.id ? (
                <div className="p-3 rounded-lg border border-rust/40 bg-rust/5 flex flex-col gap-2">
                  <input value={editQuest.title}
                    onChange={e => setEditQuest(p => ({ ...p, title: e.target.value }))}
                    className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none" />
                  <textarea value={editQuest.description}
                    onChange={e => setEditQuest(p => ({ ...p, description: e.target.value }))}
                    rows={2} className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none resize-none" />
                  <div className="flex items-center gap-2">
                    <input type="number" value={editQuest.duration_min}
                      onChange={e => setEditQuest(p => ({ ...p, duration_min: e.target.value }))}
                      className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none w-24" />
                    <span className="text-paper/30 text-xs font-mono">min</span>
                    <button onClick={() => saveQuest(q.id)} disabled={saving}
                      className="ml-auto bg-rust text-dark text-xs font-mono px-3 py-1 disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingQuestId(null)}
                      className="text-paper/40 text-xs font-mono px-2 py-1 border border-paper/20">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`p-3 rounded-lg border transition-colors flex items-start gap-2 ${selectedQuestId === q.id ? 'border-rust bg-rust/5' : 'border-paper/10 bg-paper/5 hover:border-paper/20'}`}
                  onClick={() => setSelectedQuestId(q.id === selectedQuestId ? '' : q.id)}
                >
                  <div className="flex-1 cursor-pointer">
                    <p className="text-paper text-xs font-mono">{q.title}</p>
                    {q.description && <p className="text-paper/40 text-xs mt-0.5 line-clamp-2">{q.description}</p>}
                    {q.duration_min && <p className="text-paper/20 text-xs mt-0.5 font-mono">{q.duration_min} min</p>}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setEditingQuestId(q.id); setEditQuest({ title: q.title, description: q.description || '', duration_min: q.duration_min || 45 }) }}
                    className="text-paper/30 text-xs font-mono px-2 py-0.5 border border-paper/10 hover:border-paper/40 hover:text-paper/60 transition-colors flex-shrink-0"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
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
                <th className="text-left py-2 pr-4">Admin</th>
                <th className="text-left py-2 pr-4">Joined</th>
                <th className="text-left py-2">Seed</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-paper/5 hover:bg-paper/5">
                  <td className="py-2 pr-4 text-paper">{u.name || '—'}</td>
                  <td className="py-2 pr-4 text-paper/60">{u.email}</td>
                  <td className="py-2 pr-4 text-rust">🔥 {u.streak}</td>
                  <td className="py-2 pr-4">
                    {u.email === import.meta.env.VITE_ADMIN_EMAIL ? (
                      <span className="text-gold font-mono">owner</span>
                    ) : (
                      <button
                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                        className={`px-2 py-0.5 border text-xs transition-colors ${u.is_admin ? 'border-gold text-gold hover:bg-gold/10' : 'border-paper/20 text-paper/30 hover:border-paper/40'}`}
                      >
                        {u.is_admin ? 'Admin ✓' : 'Grant'}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-paper/40">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => seedSessions(u.id)}
                      disabled={seeding === u.id}
                      className="px-2 py-0.5 border border-paper/20 text-paper/30 text-xs hover:border-gold hover:text-gold transition-colors disabled:opacity-40"
                    >
                      {seeding === u.id ? '…' : '+3'}
                    </button>
                  </td>
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
