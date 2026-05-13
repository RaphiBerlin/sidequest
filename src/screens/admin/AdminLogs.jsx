/**
 * Admin Logs — unified activity timeline across all event types
 * Tabs: All · Sessions · Drops · Signups · Push
 */
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TABS = ['All', 'Sessions', 'Drops', 'Signups', 'Push']

// ── Helpers ────────────────────────────────────────────────────────────────

function ts(dateStr) {
  return new Date(dateStr).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
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

function Badge({ children, color = 'paper' }) {
  const colors = {
    paper:   'border-paper/20 text-paper/50',
    rust:    'border-rust/40  text-rust',
    gold:    'border-gold/40  text-gold',
    green:   'border-green-500/40 text-green-400',
    red:     'border-red-500/40   text-red-400',
    blue:    'border-blue-400/40  text-blue-400',
  }
  return (
    <span className={`text-[10px] font-mono px-1.5 py-0.5 border rounded ${colors[color]}`}>
      {children}
    </span>
  )
}

function LogRow({ icon, label, badge, badgeColor, detail, time, sub }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-paper/5 last:border-0">
      <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-paper text-xs font-mono">{label}</span>
          {badge && <Badge color={badgeColor}>{badge}</Badge>}
        </div>
        {detail && <p className="text-paper/40 text-xs mt-0.5 truncate">{detail}</p>}
        {sub && <p className="text-paper/25 text-xs mt-0.5 font-mono">{sub}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-paper/30 text-[10px] font-mono">{relTime(time)}</p>
        <p className="text-paper/15 text-[10px] font-mono hidden sm:block">{ts(time)}</p>
      </div>
    </div>
  )
}

// ── Section components ─────────────────────────────────────────────────────

function SessionsLog({ sessions, loading }) {
  if (loading) return <Spinner />
  if (!sessions.length) return <Empty text="No sessions yet." />
  return (
    <div>
      {sessions.map(s => (
        <LogRow
          key={s.id}
          icon="⚔️"
          label={s.user?.name ?? 'Unknown'}
          badge={s.photo_url ? 'photo ✓' : 'no photo'}
          badgeColor={s.photo_url ? 'green' : 'paper'}
          detail={s.quest?.title}
          sub={`Party: ${(s.party_ids?.length || 0) + 1}`}
          time={s.completed_at}
        />
      ))}
    </div>
  )
}

function DropsLog({ drops, loading }) {
  if (loading) return <Spinner />
  if (!drops.length) return <Empty text="No drops logged yet." />
  return (
    <div>
      {drops.map(d => (
        <LogRow
          key={d.id}
          icon="🔥"
          label={d.label || d.quest?.title || 'Random quest'}
          badge={d.executed ? 'fired' : 'pending'}
          badgeColor={d.executed ? 'green' : 'gold'}
          detail={d.quest?.title && d.label ? d.quest.title : undefined}
          sub={d.executed_at ? `Fired at ${ts(d.executed_at)}` : undefined}
          time={d.scheduled_at}
        />
      ))}
    </div>
  )
}

function SignupsLog({ users, loading }) {
  if (loading) return <Spinner />
  if (!users.length) return <Empty text="No users yet." />
  return (
    <div>
      {users.map(u => (
        <LogRow
          key={u.id}
          icon="👤"
          label={u.name || '(no name yet)'}
          badge={u.is_admin ? 'admin' : undefined}
          badgeColor="gold"
          detail={u.email}
          sub={`Streak: 🔥 ${u.streak}`}
          time={u.created_at}
        />
      ))}
    </div>
  )
}

function PushLog({ pushLogs, subscriptions, loading }) {
  if (loading) return <Spinner />
  return (
    <div>
      <div className="bg-paper/5 rounded-xl p-4 border border-paper/10 mb-4">
        <p className="text-gold font-mono text-xs tracking-widest uppercase mb-2">Active Subscriptions</p>
        <p className="text-paper text-2xl font-mono">{subscriptions}</p>
        <p className="text-paper/30 text-xs font-mono mt-1">devices with push enabled</p>
      </div>
      {pushLogs.length === 0 ? (
        <Empty text="No push notifications sent yet. Deploy send-push and run push-logs.sql to enable logging." />
      ) : (
        pushLogs.map(p => (
          <LogRow
            key={p.id}
            icon="📣"
            label={p.title}
            badge={`${p.sent}/${p.total} sent`}
            badgeColor={p.failed > 0 ? 'red' : 'green'}
            detail={p.body}
            sub={`triggered by: ${p.triggered_by ?? 'unknown'}${p.failed > 0 ? ` · ${p.failed} failed` : ''}`}
            time={p.created_at}
          />
        ))
      )}
    </div>
  )
}

function AllLog({ all, loading }) {
  if (loading) return <Spinner />
  if (!all.length) return <Empty text="No activity yet." />
  return (
    <div>
      {all.map(item => {
        if (item._type === 'session') return (
          <LogRow key={`s-${item.id}`} icon="⚔️"
            label={item.user?.name ?? 'Unknown'}
            badge="quest complete"
            badgeColor="green"
            detail={item.quest?.title}
            time={item.completed_at}
          />
        )
        if (item._type === 'drop') return (
          <LogRow key={`d-${item.id}`} icon="🔥"
            label={item.label || item.quest?.title || 'Quest dropped'}
            badge={item.executed ? 'scheduled → fired' : 'scheduled'}
            badgeColor={item.executed ? 'green' : 'gold'}
            time={item.scheduled_at}
          />
        )
        if (item._type === 'signup') return (
          <LogRow key={`u-${item.id}`} icon="👤"
            label={item.name || item.email}
            badge="new user"
            badgeColor="blue"
            detail={item.name ? item.email : undefined}
            time={item.created_at}
          />
        )
        if (item._type === 'push') return (
          <LogRow key={`p-${item.id}`} icon="📣"
            label={item.title}
            badge={`push: ${item.sent}/${item.total}`}
            badgeColor={item.failed > 0 ? 'red' : 'green'}
            detail={item.body}
            time={item.created_at}
          />
        )
        return null
      })}
    </div>
  )
}

// ── Utility components ─────────────────────────────────────────────────────

function Spinner() {
  return <p className="text-paper/30 text-xs font-mono py-4">Loading…</p>
}

function Empty({ text }) {
  return <p className="text-paper/30 text-xs font-mono py-4">{text}</p>
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AdminLogs() {
  const [tab, setTab] = useState('All')
  const [loading, setLoading] = useState(true)

  const [sessions, setSessions]       = useState([])
  const [drops, setDrops]             = useState([])
  const [users, setUsers]             = useState([])
  const [pushLogs, setPushLogs]       = useState([])
  const [subCount, setSubCount]       = useState(0)
  const [lastRefresh, setLastRefresh] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [sess, sched, usr, push, subs] = await Promise.all([
      supabase.from('quest_sessions')
        .select('id, completed_at, photo_url, party_ids, user:users(name), quest:quests(title)')
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(100),

      supabase.from('quest_schedule')
        .select('id, scheduled_at, label, executed, executed_at, quest:quest_id(title)')
        .order('scheduled_at', { ascending: false })
        .limit(100),

      supabase.from('users')
        .select('id, name, email, streak, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(100),

      supabase.from('push_logs')
        .select('id, title, body, total, sent, failed, triggered_by, created_at')
        .order('created_at', { ascending: false })
        .limit(100),

      supabase.from('push_subscriptions')
        .select('*', { count: 'exact', head: true }),
    ])

    setSessions(sess.data || [])
    setDrops(sched.data || [])
    setUsers(usr.data || [])
    setPushLogs(push.data || [])
    setSubCount(subs.count || 0)
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const allEvents = [
    ...sessions.map(s => ({ ...s, _type: 'session', _ts: new Date(s.completed_at) })),
    ...drops.filter(d => d.executed).map(d => ({ ...d, _type: 'drop', _ts: new Date(d.scheduled_at) })),
    ...users.map(u => ({ ...u, _type: 'signup', _ts: new Date(u.created_at) })),
    ...pushLogs.map(p => ({ ...p, _type: 'push', _ts: new Date(p.created_at) })),
  ].sort((a, b) => b._ts - a._ts).slice(0, 200)

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-gold font-mono text-xs tracking-widest uppercase">Logs</h2>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <p className="text-paper/20 text-[10px] font-mono hidden sm:block">
              refreshed {relTime(lastRefresh)}
            </p>
          )}
          <button
            onClick={fetchAll}
            className="text-paper/40 text-xs font-mono border border-paper/20 px-3 py-1 hover:border-paper/40 hover:text-paper/60 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Sessions',  value: sessions.length,                                    icon: '⚔️' },
          { label: 'Drops',     value: drops.length,                                       icon: '🔥' },
          { label: 'Users',     value: users.length,                                       icon: '👤' },
          { label: 'Push sent', value: pushLogs.reduce((a, p) => a + (p.sent || 0), 0),   icon: '📣' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-paper/5 border border-paper/10 rounded-xl p-3 text-center">
            <p className="text-lg">{icon}</p>
            <p className="text-paper text-lg font-mono font-bold">{value}</p>
            <p className="text-paper/30 text-[10px] font-mono uppercase tracking-wider">{label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-paper/10 mb-4">
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

      {tab === 'All'      && <AllLog      all={allEvents}     loading={loading} />}
      {tab === 'Sessions' && <SessionsLog sessions={sessions} loading={loading} />}
      {tab === 'Drops'    && <DropsLog    drops={drops}       loading={loading} />}
      {tab === 'Signups'  && <SignupsLog  users={users}       loading={loading} />}
      {tab === 'Push'     && <PushLog     pushLogs={pushLogs} subscriptions={subCount} loading={loading} />}
    </div>
  )
}
