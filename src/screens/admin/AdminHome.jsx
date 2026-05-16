/**
 * Admin Home — scheduled drop controls + users overview
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ScheduledDrops from './ScheduledDrops'

export default function AdminHome() {
  const [activeQuest, setActiveQuest] = useState(null)
  const [quests, setQuests] = useState([])
  const [users, setUsers] = useState([])
  const [schedule, setSchedule] = useState([])
  const [dropping, setDropping] = useState(false)
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    const [aq, q, u, sc] = await Promise.all([
      supabase.from('active_quest').select('*, quest:quests(title)').order('dropped_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('quests').select('id, title').order('title'),
      supabase.from('users').select('id, name, email, streak, is_admin, created_at').order('created_at', { ascending: false }),
      supabase.from('quest_schedule').select('id, scheduled_at, label, executed, executed_at, quest:quest_id(title)').order('scheduled_at', { ascending: true }).limit(20),
    ])
    setActiveQuest(aq.data)
    setQuests(q.data || [])
    setUsers(u.data || [])
    setSchedule(sc.data || [])
    setLoading(false)
  }

  async function dropQuest(questId = selectedQuestId) {
    setDropping(true)
    await supabase.functions.invoke('drop-quest', {
      body: questId ? { quest_id: questId } : {},
    })
    await fetchData()
    setDropping(false)
  }

  async function toggleAdmin(userId, current) {
    await supabase.from('users').update({ is_admin: !current }).eq('id', userId)
    await fetchData()
  }

  if (loading) return <p className="text-paper/30 text-xs font-mono">Loading…</p>

  return (
    <div>
      {/* Scheduled drops + drop now */}
      <ScheduledDrops
        quests={quests}
        activeQuest={activeQuest}
        schedule={schedule}
        dropping={dropping}
        selectedQuestId={selectedQuestId}
        setSelectedQuestId={setSelectedQuestId}
        onDrop={dropQuest}
        onRefresh={fetchData}
      />

      {/* Users overview */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-paper/40 border-b border-paper/10">
                <th className="text-left py-2 pr-4">Name</th>
                <th className="text-left py-2 pr-4">Email</th>
                <th className="text-left py-2 pr-4">Streak</th>
                <th className="text-left py-2 pr-4">Admin</th>
                <th className="text-left py-2">Joined</th>
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
                  <td className="py-2 text-paper/40">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
