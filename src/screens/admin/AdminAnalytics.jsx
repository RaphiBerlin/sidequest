import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

const TIME_RANGES = [
  { key: '30d',  label: 'Last 30 days' },
  { key: '90d',  label: 'Last 90 days' },
  { key: 'all',  label: 'All time' },
]

const DENOM_MODES = [
  { key: 'all',    label: 'All started sessions' },
  { key: 'active', label: 'During active quest only' },
]

function rangeStart(key) {
  if (key === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - (key === '30d' ? 30 : 90))
  return d.toISOString()
}

function fmtSec(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

function pct(n, d) {
  if (!d) return '—'
  return `${Math.round((n / d) * 100)}%`
}

// ── Stat chip ────────────────────────────────────────────────────────────────
function Stat({ label, value, sub }) {
  return (
    <div className="bg-paper/5 border border-paper/10 rounded-xl p-4">
      <p className="text-paper/40 text-xs font-mono tracking-widest uppercase mb-1">{label}</p>
      <p className="text-gold font-mono text-2xl font-bold">{value ?? '—'}</p>
      {sub && <p className="text-paper/30 text-xs font-mono mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Mini bar chart (30 days) ──────────────────────────────────────────────────
function DayBars({ sessions, timeRange }) {
  const days = timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 30
  const buckets = useMemo(() => {
    const map = {}
    for (let i = 0; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - (days - 1 - i))
      map[d.toDateString()] = 0
    }
    for (const s of sessions) {
      if (!s.completed_at) continue
      const k = new Date(s.completed_at).toDateString()
      if (k in map) map[k]++
    }
    return Object.entries(map).map(([date, count]) => ({ date, count }))
  }, [sessions, days])

  const max = Math.max(...buckets.map(b => b.count), 1)
  const [hovered, setHovered] = useState(null)

  return (
    <div>
      <div className="flex items-end gap-0.5 h-16">
        {buckets.map((b, i) => (
          <div
            key={i}
            className="relative flex-1 group cursor-default"
            style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
            onMouseEnter={() => setHovered(b)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              style={{
                width: '100%',
                height: b.count === 0 ? 2 : `${Math.max(8, (b.count / max) * 64)}px`,
                backgroundColor: b.count === 0 ? 'rgba(244,237,224,0.06)' : '#c44829',
                borderRadius: 2,
                transition: 'height 0.2s ease',
                opacity: hovered?.date === b.date ? 1 : 0.7,
              }}
            />
          </div>
        ))}
      </div>
      {hovered && (
        <p className="text-paper/50 text-xs font-mono mt-2">
          {hovered.date} — <span className="text-rust">{hovered.count} completion{hovered.count !== 1 ? 's' : ''}</span>
        </p>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState('30d')
  const [denomMode, setDenomMode] = useState('all')
  const [sessions, setSessions] = useState([])    // completed sessions in range
  const [allStarted, setAllStarted] = useState([]) // all started (incl. incomplete) in range
  const [activeQuestLog, setActiveQuestLog] = useState([]) // active_quest history
  const [quests, setQuests] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('completions')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedQuestId, setExpandedQuestId] = useState(null)

  useEffect(() => {
    fetchAll()
  }, [timeRange])

  async function fetchAll() {
    setLoading(true)
    const since = rangeStart(timeRange)

    let compQ = supabase
      .from('quest_sessions')
      .select('id, quest_id, user_id, completed_at, elapsed_sec, xp_earned, party_ids, created_at')
      .not('completed_at', 'is', null)
    if (since) compQ = compQ.gte('completed_at', since)

    let startedQ = supabase
      .from('quest_sessions')
      .select('id, quest_id, user_id, completed_at, created_at, party_ids')
    if (since) startedQ = startedQ.gte('created_at', since)

    const aqQ = supabase
      .from('active_quest')
      .select('quest_id, dropped_at, expires_at')
      .order('dropped_at', { ascending: false })
      .limit(200)

    const questsQ = supabase
      .from('quests')
      .select('id, title')
      .order('title')

    const [comp, started, aq, q] = await Promise.all([compQ, startedQ, aqQ, questsQ])

    setSessions(comp.data || [])
    setAllStarted(started.data || [])
    setActiveQuestLog(aq.data || [])
    setQuests(q.data || [])
    setLoading(false)
  }

  // ── Top-line stats ───────────────────────────────────────────────────────
  const totalCompletions = sessions.length
  const uniqueQuesters = new Set(sessions.map(s => s.user_id)).size
  const avgTime = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.elapsed_sec || 0), 0) / sessions.filter(s => s.elapsed_sec).length || 0)
    : null
  const avgXp = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + (s.xp_earned || 0), 0) / sessions.length)
    : null

  // ── Per-quest table ──────────────────────────────────────────────────────
  const questRows = useMemo(() => {
    const questMap = {}
    for (const q of quests) {
      questMap[q.id] = { id: q.id, title: q.title, completions: 0, elapsed: [], xp: [], soloCount: 0, groupCount: 0, denomAll: 0, denomActive: 0, recentDates: [] }
    }

    // completed sessions
    for (const s of sessions) {
      if (!questMap[s.quest_id]) continue
      const r = questMap[s.quest_id]
      r.completions++
      if (s.elapsed_sec) r.elapsed.push(s.elapsed_sec)
      if (s.xp_earned) r.xp.push(s.xp_earned)
      const isGroup = s.party_ids?.length > 0
      if (isGroup) r.groupCount++; else r.soloCount++
      r.recentDates.push(s.completed_at)
    }

    // denominator: all started
    for (const s of allStarted) {
      if (!questMap[s.quest_id]) continue
      questMap[s.quest_id].denomAll++
    }

    // denominator: active quest window
    for (const s of allStarted) {
      if (!questMap[s.quest_id]) continue
      const created = new Date(s.created_at)
      const wasActive = activeQuestLog.some(aq =>
        aq.quest_id === s.quest_id &&
        created >= new Date(aq.dropped_at) &&
        (!aq.expires_at || created <= new Date(aq.expires_at))
      )
      if (wasActive) questMap[s.quest_id].denomActive++
    }

    return Object.values(questMap)
      .filter(r => r.completions > 0 || r.denomAll > 0)
      .map(r => {
        const denom = denomMode === 'active' ? r.denomActive : r.denomAll
        return {
          ...r,
          avgTime: r.elapsed.length ? Math.round(r.elapsed.reduce((a, b) => a + b, 0) / r.elapsed.length) : null,
          avgXp: r.xp.length ? Math.round(r.xp.reduce((a, b) => a + b, 0) / r.xp.length) : null,
          compRate: pct(r.completions, denom),
          compRateNum: denom ? r.completions / denom : 0,
          soloRate: r.completions ? Math.round((r.soloCount / r.completions) * 100) : 0,
          recentDates: r.recentDates.slice(-10).reverse(),
        }
      })
  }, [sessions, allStarted, activeQuestLog, quests, denomMode])

  const sorted = useMemo(() => {
    return [...questRows].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey]
      if (sortKey === 'compRate') { av = a.compRateNum; bv = b.compRateNum }
      if (sortKey === 'avgTime') { av = a.avgTime ?? -1; bv = b.avgTime ?? -1 }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [questRows, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const ColHeader = ({ label, k }) => (
    <th
      className="text-left py-2 pr-4 cursor-pointer select-none"
      onClick={() => toggleSort(k)}
    >
      <span className={`font-mono text-xs tracking-widest uppercase ${sortKey === k ? 'text-gold' : 'text-paper/40'} hover:text-paper/60 transition-colors`}>
        {label}{sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
      </span>
    </th>
  )

  if (loading) return <p className="text-paper/30 text-xs font-mono">Loading…</p>

  return (
    <div className="flex flex-col gap-8">

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-6 items-center">
        <div>
          <p className="text-paper/30 text-xs font-mono tracking-widest uppercase mb-1.5">Time range</p>
          <div className="flex gap-1">
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`text-xs font-mono px-3 py-1.5 border transition-colors ${timeRange === r.key ? 'border-rust text-rust bg-rust/10' : 'border-paper/20 text-paper/40 hover:border-paper/40'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-paper/30 text-xs font-mono tracking-widest uppercase mb-1.5">Completion rate denominator</p>
          <div className="flex gap-1">
            {DENOM_MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setDenomMode(m.key)}
                className={`text-xs font-mono px-3 py-1.5 border transition-colors ${denomMode === m.key ? 'border-gold text-gold bg-gold/10' : 'border-paper/20 text-paper/40 hover:border-paper/40'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fetchAll}
          className="text-xs font-mono border border-paper/20 px-3 py-1.5 text-paper/40 hover:border-paper/60 hover:text-paper/60 transition-colors mt-auto"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Top-line stats ── */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Completions" value={totalCompletions.toLocaleString()} />
          <Stat label="Unique questers" value={uniqueQuesters.toLocaleString()} />
          <Stat label="Avg time" value={fmtSec(avgTime)} />
          <Stat label="Avg XP earned" value={avgXp != null ? `+${avgXp}` : '—'} />
        </div>
      </section>

      {/* ── Activity bars ── */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">
          Completions per day {timeRange !== 'all' ? `(${TIME_RANGES.find(r => r.key === timeRange)?.label.toLowerCase()})` : '(last 30 days)'}
        </h2>
        <div className="bg-paper/5 border border-paper/10 rounded-xl p-4">
          <DayBars sessions={sessions} timeRange={timeRange === 'all' ? '30d' : timeRange} />
        </div>
      </section>

      {/* ── Per-quest table ── */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">
          Per-quest breakdown ({sorted.length} quests)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-paper/10">
                <ColHeader label="Quest" k="title" />
                <ColHeader label="Completions" k="completions" />
                <ColHeader label="Comp. rate" k="compRate" />
                <ColHeader label="Avg time" k="avgTime" />
                <ColHeader label="Avg XP" k="avgXp" />
                <ColHeader label="Solo %" k="soloRate" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => (
                <>
                  <tr
                    key={r.id}
                    className="border-b border-paper/5 hover:bg-paper/5 cursor-pointer transition-colors"
                    onClick={() => setExpandedQuestId(expandedQuestId === r.id ? null : r.id)}
                  >
                    <td className="py-2.5 pr-4 text-paper font-medium">{r.title}</td>
                    <td className="py-2.5 pr-4 text-rust font-mono">{r.completions}</td>
                    <td className="py-2.5 pr-4 font-mono text-paper/70">{r.compRate}</td>
                    <td className="py-2.5 pr-4 font-mono text-paper/70">{fmtSec(r.avgTime)}</td>
                    <td className="py-2.5 pr-4 font-mono text-gold">{r.avgXp != null ? `+${r.avgXp}` : '—'}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 rounded-full bg-paper/10 w-16 overflow-hidden">
                          <div className="h-full bg-rust rounded-full" style={{ width: `${r.soloRate}%` }} />
                        </div>
                        <span className="font-mono text-paper/50">{r.soloRate}%</span>
                      </div>
                    </td>
                  </tr>

                  {expandedQuestId === r.id && (
                    <tr key={`${r.id}-exp`} className="bg-paper/3">
                      <td colSpan={6} className="py-3 px-3">
                        <p className="text-paper/30 font-mono text-xs tracking-widest uppercase mb-2">Last {r.recentDates.length} completions</p>
                        {r.recentDates.length === 0 ? (
                          <p className="text-paper/20 font-mono text-xs">No completions yet.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {r.recentDates.map((d, i) => (
                              <span key={i} className="text-xs font-mono bg-paper/5 border border-paper/10 px-2 py-0.5 text-paper/50">
                                {new Date(d).toLocaleString()}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Recent completions feed ── */}
      <section>
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase mb-3">Recent completions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-paper/10 text-paper/40 font-mono tracking-widest uppercase">
                <th className="text-left py-2 pr-4">When</th>
                <th className="text-left py-2 pr-4">Quest</th>
                <th className="text-left py-2 pr-4">Time</th>
                <th className="text-left py-2 pr-4">XP</th>
                <th className="text-left py-2">Mode</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 20).map(s => {
                const questTitle = quests.find(q => q.id === s.quest_id)?.title ?? '—'
                const isGroup = s.party_ids?.length > 0
                return (
                  <tr key={s.id} className="border-b border-paper/5 hover:bg-paper/5">
                    <td className="py-2 pr-4 font-mono text-paper/50">{new Date(s.completed_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-paper">{questTitle}</td>
                    <td className="py-2 pr-4 font-mono text-paper/60">{fmtSec(s.elapsed_sec)}</td>
                    <td className="py-2 pr-4 font-mono text-gold">{s.xp_earned != null ? `+${s.xp_earned}` : '—'}</td>
                    <td className="py-2">
                      <span className={`font-mono text-xs px-1.5 py-0.5 border ${isGroup ? 'border-gold/30 text-gold' : 'border-paper/15 text-paper/30'}`}>
                        {isGroup ? `Group +${s.party_ids.length}` : 'Solo'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  )
}
