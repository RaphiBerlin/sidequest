import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/NotificationsContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import Avatar from '../components/Avatar'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function notificationMessage(n) {
  const name = n.from_user?.name || 'Someone'
  switch (n.type) {
    case 'friend_accepted': return `You and ${name} are now friends`
    case 'friend_quest_complete': {
      const title = n.data?.quest_title
      return title ? `${name} just completed "${title}"` : `${name} just completed a quest`
    }
    case 'reaction': return `${name} reacted ${n.data?.emoji || '❤️'} to your quest`
    case 'quest_invite': return `${name} invited you to quest together`
    default: return `${name} did something`
  }
}

function notificationIcon(type) {
  switch (type) {
    case 'friend_quest_complete': return '⚡'
    case 'friend_accepted': return '🤝'
    case 'reaction': return '❤️'
    default: return null
  }
}

export default function Notifications() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { notifications, markAllRead, markRead, refetch } = useNotifications()
  const [profile, setProfile] = useState(null)
  // Track which request notifications have been accepted (show "now friends" inline)
  const [acceptedIds, setAcceptedIds] = useState(new Set())
  // Track which notifications have been dismissed (removed from view)
  const [dismissedIds, setDismissedIds] = useState(new Set())
  const [joiningInviteId, setJoiningInviteId] = useState(null)

  useEffect(() => {
    markAllRead()
  }, [])

  // Auto-mark-read any notification that arrives while this page is open
  useEffect(() => {
    const unread = notifications.filter(n => !n.read)
    if (unread.length === 0) return
    unread.forEach(n => markRead(n.id))
  }, [notifications])

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, avatar_url, avatar_color').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data) })
  }, [user])

  async function handleAcceptRequest(n) {
    if (!n.data?.friendship_id) return
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', n.data.friendship_id)
    // Notify the requester
    await supabase.from('notifications').insert({
      user_id: n.from_user_id,
      type: 'friend_accepted',
      from_user_id: user.id,
      data: {},
    })
    await markRead(n.id)
    // Show "now friends" inline instead of navigating away
    setAcceptedIds(prev => new Set([...prev, n.id]))
    refetch()
  }

  async function handleDeclineRequest(n) {
    if (n.data?.friendship_id) {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', n.data.friendship_id)
    }
    // Delete the notification entirely
    await supabase.from('notifications').delete().eq('id', n.id)
    setDismissedIds(prev => new Set([...prev, n.id]))
    refetch()
  }

  async function handleAcceptInvite(n) {
    if (!n.data?.crew_invite_id || !n.data?.session_id) return
    setJoiningInviteId(n.id)
    try {
      // Mark invite as accepted
      await supabase
        .from('crew_invites')
        .update({ status: 'accepted' })
        .eq('id', n.data.crew_invite_id)

      // Fetch session + quest so we can reconstruct activeQuest state
      const { data: session } = await supabase
        .from('quest_sessions')
        .select('id, quest_id, started_at, quest:quests(id, title, description, xp, duration_min, context_tags, expires_at)')
        .eq('id', n.data.session_id)
        .single()

      // Store session_id so ActiveQuest skips creating a new one
      localStorage.setItem('sq_session_id', n.data.session_id)

      // Build activeQuest-compatible object, falling back to data cached in notification
      const activeQuestData = n.data.active_quest ?? {
        quest_id: session?.quest_id,
        quest: session?.quest,
        expires_at: session?.quest?.expires_at
          ?? new Date(new Date(session?.started_at).getTime() + (session?.quest?.duration_min ?? 45) * 60000).toISOString(),
      }

      await markRead(n.id)
      navigate('/active-quest', { state: { activeQuest: activeQuestData } })
    } catch (e) {
      console.error('handleAcceptInvite error:', e)
      setJoiningInviteId(null)
    }
  }

  async function handleDeclineInvite(n) {
    if (n.data?.crew_invite_id) {
      await supabase
        .from('crew_invites')
        .update({ status: 'declined' })
        .eq('id', n.data.crew_invite_id)
    }
    await supabase.from('notifications').delete().eq('id', n.id)
    setDismissedIds(prev => new Set([...prev, n.id]))
    refetch()
  }

  const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id))
  const pendingRequests = visibleNotifications.filter(
    n => n.type === 'friend_request' && n.data?.friendship_id && !acceptedIds.has(n.id)
  )
  const acceptedRequests = visibleNotifications.filter(
    n => n.type === 'friend_request' && acceptedIds.has(n.id)
  )
  const pendingInvites = visibleNotifications.filter(
    n => n.type === 'quest_invite' && n.data?.crew_invite_id
  )
  const otherNotifications = visibleNotifications.filter(
    n => (n.type !== 'friend_request' || !n.data?.friendship_id)
      && !(n.type === 'quest_invite' && n.data?.crew_invite_id)
  )
  // Merge accepted-request confirmations into the activity feed
  const activityNotifications = [
    ...acceptedRequests.map(n => ({ ...n, _confirmedAccept: true })),
    ...otherNotifications,
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const isEmpty = pendingRequests.length === 0 && pendingInvites.length === 0 && activityNotifications.length === 0

  return (
    <div
      className="min-h-screen bg-paper pb-24"
      style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <h1
          className="italic text-4xl text-dark"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Notifications
        </h1>
        <button onClick={() => navigate('/settings')} className="flex-shrink-0 rounded-full overflow-hidden hover:opacity-80 transition-opacity focus:outline-none">
          <Avatar src={profile?.avatar_url} name={profile?.name || user?.email} color={profile?.avatar_color} size={36} />
        </button>

      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-8">
          <p
            className="italic text-xl mb-3 leading-relaxed"
            style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196, 72, 41, 0.6)' }}
          >
            All quiet here.
          </p>
          <p
            className="text-dark/30 text-xs"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Friend requests and activity will appear here.
          </p>
        </div>
      ) : (
        <div className="px-5 flex flex-col gap-2">

          {/* Pending friend requests */}
          {pendingRequests.length > 0 && (
            <div className="mb-2">
              <p
                className="text-dark/40 text-xs tracking-widest uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Requests
              </p>
              {pendingRequests.map(n => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl border border-dark/5 px-4 py-3 flex items-center gap-3 mb-2"
                >
                  <Avatar
                    src={n.from_user?.avatar_url}
                    name={n.from_user?.name}
                    color={n.from_user?.avatar_color}
                    size={44}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-dark text-sm font-medium truncate">
                      {n.from_user?.name || 'Someone'}
                    </p>
                    <p
                      className="text-dark/40 text-xs"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      wants to be friends
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(n)}
                      className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium"
                      style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(n)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-dark/20 text-dark/60 font-medium"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending quest invites */}
          {pendingInvites.length > 0 && (
            <div className="mb-2">
              <p
                className="text-dark/40 text-xs tracking-widest uppercase mb-2"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Quest Invites
              </p>
              {pendingInvites.map(n => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl border border-dark/5 px-4 py-3 flex items-center gap-3 mb-2"
                >
                  <Avatar
                    src={n.from_user?.avatar_url}
                    name={n.from_user?.name}
                    color={n.from_user?.avatar_color}
                    size={44}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-dark text-sm font-medium truncate">
                      {n.from_user?.name || 'Someone'}
                    </p>
                    <p className="text-dark/50 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {n.data?.quest_title ? `"${n.data.quest_title}"` : 'invited you to quest together'}
                    </p>
                    <p className="text-dark/30 text-xs mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptInvite(n)}
                      disabled={joiningInviteId === n.id}
                      className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {joiningInviteId === n.id ? '…' : 'Join'}
                    </button>
                    <button
                      onClick={() => handleDeclineInvite(n)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-dark/20 text-dark/60 font-medium"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Activity feed (other notifications + accepted confirmations) */}
          {activityNotifications.length > 0 && (
            <div>
              {pendingRequests.length > 0 && (
                <p
                  className="text-dark/40 text-xs tracking-widest uppercase mb-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Activity
                </p>
              )}
              {activityNotifications.map(n => (
                <div
                  key={n.id}
                  className="bg-white rounded-xl border border-dark/5 px-4 py-3 flex items-center gap-3 mb-2"
                >
                  <Avatar
                    src={n.from_user?.avatar_url}
                    name={n.from_user?.name}
                    color={n.from_user?.avatar_color}
                    size={44}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-dark text-sm leading-snug">
                      {n._confirmedAccept
                        ? `You and ${n.from_user?.name || 'Someone'} are now friends`
                        : notificationMessage(n)}
                    </p>
                    <p
                      className="text-dark/30 text-xs mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {(n._confirmedAccept || notificationIcon(n.type)) && (
                    <span className="text-base flex-shrink-0">
                      {n._confirmedAccept ? '🤝' : notificationIcon(n.type)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
