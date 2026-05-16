/**
 * Reusable scheduled-drops panel — appears on Admin Home and Admin Quests.
 */
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function ScheduledDrops({ quests, activeQuest, schedule, dropping, selectedQuestId, setSelectedQuestId, onDrop, onRefresh }) {
  const [scheduleQuestId, setScheduleQuestId] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [scheduleLabel, setScheduleLabel] = useState('')
  const [scheduling, setScheduling] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  function timeRemaining(expiresAt) {
    const diff = new Date(expiresAt) - Date.now()
    if (diff <= 0) return 'Expired'
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    return `${m}m ${s}s`
  }

  async function scheduleQuest() {
    if (!scheduleAt) return
    setScheduling(true)
    try {
      const { error } = await supabase.functions.invoke('drop-quest', {
        body: {
          action: 'schedule',
          quest_id: scheduleQuestId || null,
          scheduled_at: new Date(scheduleAt).toISOString(),
          label: scheduleLabel || null,
        },
      })
      if (error) { alert('Schedule failed: ' + error.message); return }
      setScheduleAt('')
      setScheduleLabel('')
      setScheduleQuestId('')
      await onRefresh()
    } finally {
      setScheduling(false)
    }
  }

  async function cancelSchedule(id) {
    setCancellingId(id)
    try {
      await supabase.functions.invoke('drop-quest', { body: { action: 'cancel', id } })
      await onRefresh()
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="mb-8">
      {/* Active quest status */}
      <div className="bg-paper/5 rounded-xl p-4 border border-paper/10 mb-4">
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

      {/* Drop now */}
      <div className="flex gap-2 items-center mb-6">
        <select
          value={selectedQuestId}
          onChange={e => setSelectedQuestId(e.target.value)}
          className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none"
        >
          <option value="">Random quest</option>
          {quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
        </select>
        <button
          onClick={() => onDrop(selectedQuestId)}
          disabled={dropping}
          className="bg-rust text-dark text-xs font-mono px-4 py-2 tracking-widest uppercase disabled:opacity-50 whitespace-nowrap"
        >
          {dropping ? 'Dropping…' : 'Drop now'}
        </button>
      </div>

      {/* Schedule form */}
      <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Scheduled Drops</h2>
      <div className="bg-paper/5 border border-paper/10 rounded-xl p-4 mb-3 flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={e => setScheduleAt(e.target.value)}
            className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none"
          />
          <select
            value={scheduleQuestId}
            onChange={e => setScheduleQuestId(e.target.value)}
            className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none"
          >
            <option value="">Random quest</option>
            {quests.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Label (optional, e.g. Monday evening)"
            value={scheduleLabel}
            onChange={e => setScheduleLabel(e.target.value)}
            className="flex-1 bg-paper/5 border border-paper/20 text-paper text-xs font-mono px-3 py-2 rounded outline-none placeholder-paper/25"
          />
          <button
            onClick={scheduleQuest}
            disabled={scheduling || !scheduleAt}
            className="bg-gold text-dark text-xs font-mono px-4 py-2 tracking-widest uppercase disabled:opacity-50 whitespace-nowrap"
          >
            {scheduling ? 'Scheduling…' : 'Schedule'}
          </button>
        </div>
      </div>

      {/* Scheduled list */}
      {schedule.length === 0 ? (
        <p className="text-paper/30 text-xs font-mono">No scheduled drops.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {schedule.map(s => {
            const isPast = new Date(s.scheduled_at) < new Date()
            return (
              <div key={s.id} className={`flex items-center gap-3 p-3 rounded-lg border ${s.executed ? 'border-paper/5 opacity-40' : isPast ? 'border-rust/40 bg-rust/5' : 'border-paper/10 bg-paper/5'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-paper text-xs font-mono">
                    {new Date(s.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {s.label && <span className="text-paper/50 ml-2">— {s.label}</span>}
                  </p>
                  <p className="text-paper/40 text-xs mt-0.5">{s.quest?.title ?? 'Random quest'}</p>
                </div>
                {s.executed ? (
                  <span className="text-green-400 text-xs font-mono">✓ fired</span>
                ) : isPast ? (
                  <span className="text-rust text-xs font-mono animate-pulse">overdue</span>
                ) : null}
                {!s.executed && (
                  <button
                    onClick={() => cancelSchedule(s.id)}
                    disabled={cancellingId === s.id}
                    className="text-paper/30 text-xs font-mono border border-paper/10 px-2 py-0.5 hover:border-rust hover:text-rust transition-colors"
                  >
                    {cancellingId === s.id ? '…' : 'Cancel'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-paper/20 text-xs font-mono mt-3">
        Auto-execution requires a Supabase Cron Job calling <span className="text-paper/40">drop-quest</span> with <span className="text-paper/40">{`{"action":"cron"}`}</span> on a schedule.
      </p>
    </div>
  )
}
