/**
 * Admin Quests — scheduled drops at top + full quest management
 */
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ScheduledDrops from './ScheduledDrops'

export default function AdminQuests() {
  const [activeQuest, setActiveQuest] = useState(null)
  const [quests, setQuests] = useState([])
  const [schedule, setSchedule] = useState([])
  const [dropping, setDropping] = useState(false)
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [loading, setLoading] = useState(true)
  const [showCreateQuest, setShowCreateQuest] = useState(false)
  const [newQuest, setNewQuest] = useState({ title: '', description: '', duration_min: 45 })
  const [creating, setCreating] = useState(false)
  const [editingQuestId, setEditingQuestId] = useState(null)
  const [editQuest, setEditQuest] = useState({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchData() {
    const [aq, q, sc] = await Promise.all([
      supabase.from('active_quest').select('*, quest:quests(title)').order('dropped_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('quests').select('id, title, description, duration_min').order('title'),
      supabase.from('quest_schedule').select('id, scheduled_at, label, executed, executed_at, quest:quest_id(title)').order('scheduled_at', { ascending: true }).limit(20),
    ])
    setActiveQuest(aq.data)
    setQuests(q.data || [])
    setSchedule(sc.data || [])
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
    setSaveError(null)
    const { error } = await supabase.from('quests').update({
      title: editQuest.title.trim(),
      description: editQuest.description.trim(),
      duration_min: Number(editQuest.duration_min) || 45,
    }).eq('id', id)
    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }
    setEditingQuestId(null)
    await fetchData()
    setSaving(false)
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

      {/* Quest library */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gold font-mono text-xs tracking-widest uppercase">All Quests ({quests.length})</h2>
          <button
            onClick={() => setShowCreateQuest(v => !v)}
            className="text-xs font-mono border border-paper/20 px-3 py-1 text-paper/60 hover:border-gold hover:text-gold transition-colors"
          >
            {showCreateQuest ? 'Cancel' : '+ New quest'}
          </button>
        </div>

        {/* Create form */}
        {showCreateQuest && (
          <div className="bg-paper/5 rounded-xl p-4 border border-paper/10 mb-3 flex flex-col gap-3">
            <input
              placeholder="Quest title"
              value={newQuest.title}
              onChange={e => setNewQuest(p => ({ ...p, title: e.target.value }))}
              className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none placeholder-paper/30"
            />
            <textarea
              placeholder="Description (optional)"
              value={newQuest.description}
              onChange={e => setNewQuest(p => ({ ...p, description: e.target.value }))}
              rows={2}
              className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none placeholder-paper/30 resize-none"
            />
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="Duration (min)"
                value={newQuest.duration_min}
                onChange={e => setNewQuest(p => ({ ...p, duration_min: e.target.value }))}
                className="bg-transparent border-b border-paper/20 text-paper text-sm font-mono py-1 outline-none w-32"
              />
              <button
                onClick={createQuest}
                disabled={creating || !newQuest.title.trim()}
                className="ml-auto bg-gold text-dark text-xs font-mono px-4 py-1.5 tracking-widest uppercase disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Quest list */}
        <div className="flex flex-col gap-1">
          {quests.map(q => (
            <div key={q.id}>
              {editingQuestId === q.id ? (
                <div className="p-3 rounded-lg border border-rust/40 bg-rust/5 flex flex-col gap-2">
                  <input
                    value={editQuest.title}
                    onChange={e => setEditQuest(p => ({ ...p, title: e.target.value }))}
                    className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none"
                  />
                  <textarea
                    value={editQuest.description}
                    onChange={e => setEditQuest(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none resize-none"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editQuest.duration_min}
                      onChange={e => setEditQuest(p => ({ ...p, duration_min: e.target.value }))}
                      className="bg-transparent border-b border-paper/20 text-paper text-xs font-mono py-1 outline-none w-24"
                    />
                    <span className="text-paper/30 text-xs font-mono">min</span>
                    <button
                      onClick={() => saveQuest(q.id)}
                      disabled={saving}
                      className="ml-auto bg-rust text-dark text-xs font-mono px-3 py-1 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingQuestId(null); setSaveError(null) }}
                      className="text-paper/40 text-xs font-mono px-2 py-1 border border-paper/20"
                    >
                      Cancel
                    </button>
                  </div>
                  {saveError && (
                    <p className="text-red-400 text-xs font-mono mt-1">{saveError}</p>
                  )}
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
                    onClick={e => {
                      e.stopPropagation()
                      setEditingQuestId(q.id)
                      setEditQuest({ title: q.title, description: q.description || '', duration_min: q.duration_min || 45 })
                    }}
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
    </div>
  )
}
