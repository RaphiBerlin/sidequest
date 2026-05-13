import { useEffect } from 'react'
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
    case 'friend_request': return `${name} sent you a friend request`
    case 'friend_accepted': return `${name} accepted your friend request`
    case 'reaction': return `${name} reacted ${n.data?.emoji || '❤️'} to your quest`
    case 'quest_invite': return `${name} invited you to quest together`
    default: return `${name} did something`
  }
}

export default function Notifications() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notifications, markAllRead, markRead, refetch } = useNotifications()

  // Mark all read when screen opens
  useEffect(() => {
    markAllRead()
  }, [])

  async function handleAcceptRequest(n) {
    if (!n.data?.friendship_id) return
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', n.data.friendship_id)
    // Create friend_accepted notification for the requester
    await supabase.from('notifications').insert({
      user_id: n.from_user_id,
      type: 'friend_accepted',
      from_user_id: user.id,
      data: {},
    })
    await markRead(n.id)
    refetch()
    navigate('/friends')
  }

  async function handleDeclineRequest(n) {
    if (n.data?.friendship_id) {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', n.data.friendship_id)
    }
    await markRead(n.id)
    refetch()
  }

  const pendingRequests = notifications.filter(n => n.type === 'friend_request' && n.data?.friendship_id)
  const otherNotifications = notifications.filter(n => n.type !== 'friend_request' || !n.data?.friendship_id)

  return (
    <div
      className="min-h-screen bg-paper pb-24"
      style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
    >
      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-start justify-between">
        <h1
          className="italic text-4xl text-dark"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Notifications
        </h1>
      </div>

      {notifications.length === 0 ? (
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

          {/* Other notifications */}
          {otherNotifications.length > 0 && (
            <div>
              {pendingRequests.length > 0 && (
                <p
                  className="text-dark/40 text-xs tracking-widest uppercase mb-2"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Activity
                </p>
              )}
              {otherNotifications.map(n => (
                <div
                  key={n.id}
                  className={`rounded-xl border px-4 py-3 flex items-center gap-3 mb-2 transition-colors ${
                    !n.read ? 'bg-rust/5 border-rust/15' : 'bg-white border-dark/5'
                  }`}
                >
                  <Avatar
                    src={n.from_user?.avatar_url}
                    name={n.from_user?.name}
                    color={n.from_user?.avatar_color}
                    size={44}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-dark text-sm leading-snug">
                      {notificationMessage(n)}
                    </p>
                    <p
                      className="text-dark/30 text-xs mt-0.5"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-rust flex-shrink-0" />
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
