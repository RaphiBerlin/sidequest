/**
 * Admin Users — full users table + recent sessions
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(null)
  const [banning, setBanning] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    const [u, s] = await Promise.all([
      supabase.from('users').select('id, name, email, streak, is_admin, is_banned, created_at').order('created_at', { ascending: false }),
      supabase.from('quest_sessions')
        .select('id, completed_at, photo_url, party_ids, user:users(name), quest:quests(title)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(30),
    ])
    setUsers(u.data || [])
    setRecentSessions(s.data || [])
    setLoading(false)
  }

  async function toggleAdmin(userId, current) {
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId)
    await fetchData()
  }

  async function toggleBan(userId, current) {
    setBanning(userId)
    const { error, count } = await supabase
      .from('users')
      .update({ is_banned: !current }, { count: 'exact' })
      .eq('id', userId)
    if (error) {
      alert('Ban failed: ' + error.message)
    } else if (count === 0) {
      alert('Ban failed: RLS blocked the update. Run the admin update policy in Supabase SQL Editor.')
    } else {
      await fetchData()
    }
    setBanning(null)
  }

  async function seedSessions(userId) {
    setSeeding(userId)
    try {
      const { error } = await supabase.rpc('seed_test_sessions', { target_user_id: userId })
      if (error) alert('Seed failed: ' + error.message)
      else await fetchData()
    } finally {
      setSeeding(null)
    }
  }

  if (loading) return <p className="text-paper/30 text-xs font-mono">Loading…</p>

  return (
    <div>
      {/* Users table */}
      <section className="mb-10">
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
                <th className="text-left py-2 pr-4">Seed</th>
                <th className="text-left py-2">Ban</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const isOwner = u.email === import.meta.env.VITE_ADMIN_EMAIL
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-paper/5 hover:bg-paper/5 ${u.is_banned ? 'opacity-50' : ''}`}
                  >
                    <td className="py-2 pr-4 text-paper">
                      {u.name || '—'}
                      {u.is_banned && <span className="ml-2 text-[10px] text-red-400 font-mono border border-red-400/40 px-1 rounded">banned</span>}
                    </td>
                    <td className="py-2 pr-4 text-paper/60">{u.email}</td>
                    <td className="py-2 pr-4 text-rust">🔥 {u.streak}</td>
                    <td className="py-2 pr-4">
                      {isOwner ? (
                        <span className="text-gold">owner</span>
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
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => seedSessions(u.id)}
                        disabled={seeding === u.id}
                        className="px-2 py-0.5 border border-paper/20 text-paper/30 text-xs hover:border-gold hover:text-gold transition-colors disabled:opacity-40"
                      >
                        {seeding === u.id ? '…' : '+3'}
                      </button>
                    </td>
                    <td className="py-2">
                      {isOwner ? (
                        <span className="text-paper/20">—</span>
                      ) : (
                        <button
                          onClick={() => toggleBan(u.id, u.is_banned)}
                          disabled={banning === u.id}
                          className={`px-2 py-0.5 border text-xs transition-colors disabled:opacity-40 ${
                            u.is_banned
                              ? 'border-green-500/40 text-green-400 hover:bg-green-500/10'
                              : 'border-red-500/30 text-red-400/60 hover:border-red-500/60 hover:text-red-400'
                          }`}
                        >
                          {banning === u.id ? '…' : u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent sessions */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Recent Sessions ({recentSessions.length})</h2>
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
