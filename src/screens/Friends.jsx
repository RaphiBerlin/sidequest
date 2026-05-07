import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getInviteLink } from '../lib/invites'
import { useToast } from '../context/ToastContext'
import Skeleton from '../components/Skeleton'
import { contactsSupported, getContactPhones, hashContactPhones } from '../lib/contacts'

function AvatarCircle({ name, avatarColor, size = 48 }) {
  const initial = (name || '?')[0].toUpperCase()
  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        backgroundColor: avatarColor || '#c44829',
        color: '#f4ede0',
        fontSize: size * 0.4,
        fontFamily: "'Fraunces', serif",
      }}
    >
      {initial}
    </div>
  )
}

function SkeletonFriendCard() {
  return (
    <div className="mx-5 my-1 px-4 py-3 rounded-xl bg-dark/5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-dark/10 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-dark/10 rounded w-2/5" />
        </div>
      </div>
    </div>
  )
}

export default function Friends() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState([])
  const [acceptedFriends, setAcceptedFriends] = useState([])
  const [copied, setCopied] = useState(false)
  const [contactMatches, setContactMatches] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsScanned, setContactsScanned] = useState(false)

  async function fetchFriendships() {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status, tier, user_id, friend_id,
        requester:users!friendships_user_id_fkey(id, name, avatar_color),
        recipient:users!friendships_friend_id_fkey(id, name, avatar_color)
      `)
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

    if (!data) {
      setLoading(false)
      return
    }

    const pending = data.filter(
      f => f.friend_id === user.id && f.status === 'pending'
    )

    const accepted = data
      .filter(f => f.status === 'accepted')
      .map(f => {
        const other = f.user_id === user.id ? f.recipient : f.requester
        return { friendshipId: f.id, ...other }
      })

    setPendingRequests(pending)
    setAcceptedFriends(accepted)
    setLoading(false)
  }

  useEffect(() => {
    fetchFriendships()
  }, [user])

  async function handleAccept(friendshipId) {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
    fetchFriendships()
  }

  async function handleDecline(friendshipId) {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)
    fetchFriendships()
  }

  async function shareInvite() {
    const link = await getInviteLink(user.id)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Side / Quest', text: 'Come quest with me!', url: link })
        return
      } catch (e) {}
    }
    await navigator.clipboard.writeText(link)
    showToast('Invite link copied!', 'success')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function findFromContacts() {
    setContactsLoading(true)
    try {
      const phones = await getContactPhones()
      if (phones.length > 0) {
        const hashes = await hashContactPhones(phones)
        await supabase.rpc('store_contact_hashes', { hashes })
      }
      const { data, error } = await supabase.rpc('get_contact_suggestions')
      if (error) throw error
      setContactMatches((data || []).filter(u => !u.already_friends))
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Could not access contacts', 'error')
    }
    setContactsScanned(true)
    setContactsLoading(false)
  }

  async function addFromContacts(userId) {
    await supabase.from('friendships').insert({
      user_id: user.id,
      friend_id: userId,
      status: 'pending',
    })
    setContactMatches(prev => prev.filter(u => u.user_id !== userId))
    showToast('Friend request sent!', 'success')
  }

  const filteredFriends = acceptedFriends.filter(f =>
    (f.name || '').toLowerCase().includes(search.toLowerCase())
  )

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
          Friends
        </h1>
        {/* + Add friends button */}
        <button
          onClick={shareInvite}
          className="w-9 h-9 rounded-full flex items-center justify-center text-paper text-xl font-bold mt-1"
          style={{ backgroundColor: '#c44829' }}
          aria-label="Invite a friend"
        >
          {copied ? '✓' : '+'}
        </button>
      </div>

      {/* Search bar */}
      <input
        placeholder="Search friends..."
        className="mx-5 mb-4 bg-dark/5 rounded-lg px-4 py-2 text-dark/70 text-sm outline-none"
        style={{ width: 'calc(100% - 40px)' }}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Find from contacts */}
      {!contactsScanned && (
        <button
          onClick={contactsSupported() ? findFromContacts : () => setContactsScanned(true)}
          disabled={contactsLoading}
          className="mx-5 mb-4 w-[calc(100%-40px)] py-2.5 px-4 rounded-xl border border-dark/15 flex items-center gap-3 text-left hover:bg-dark/5 transition-colors disabled:opacity-40"
        >
          <span className="text-xl">📱</span>
          <div className="flex-1">
            <p
              className="text-dark text-sm font-medium"
              style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
            >
              {contactsLoading ? 'Scanning contacts…' : 'Find friends from contacts'}
            </p>
            <p
              className="text-dark/40 text-xs"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {contactsSupported() ? 'See who\'s already on the app' : 'Open on mobile to import contacts'}
            </p>
          </div>
          <span className="text-dark/30 text-sm">→</span>
        </button>
      )}

      {/* Contact matches */}
      {contactMatches.length > 0 && (
        <div className="mb-4">
          <p
            className="px-5 text-dark/40 text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            In your contacts
          </p>
          {contactMatches.map(match => (
            <div
              key={match.user_id}
              className="mx-5 my-1 px-4 py-3 rounded-xl bg-white border border-dark/5 flex items-center gap-3"
            >
              <AvatarCircle name={match.name} avatarColor={match.avatar_color} />
              <div className="flex-1 min-w-0">
                <p className="text-dark font-medium truncate">{match.name}</p>
                <p className="text-dark/40 text-xs truncate"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {match.connection_type === 'fof' ? `friend of ${match.via_name}` : 'in your contacts'}
                </p>
              </div>
              <button
                onClick={() => addFromContacts(match.user_id)}
                className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium flex-shrink-0"
                style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {contactsScanned && contactMatches.length === 0 && (
        <p
          className="px-5 mb-4 text-dark/30 text-xs"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          No contacts found on sidequest yet.
        </p>
      )}

      {/* Pending requests section */}
      {!loading && pendingRequests.length > 0 && (
        <div className="mb-4">
          <p
            className="px-5 text-dark/40 text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Requests
          </p>
          {pendingRequests.map(req => {
            const requester = req.requester
            return (
              <div
                key={req.id}
                className="mx-5 my-1 px-4 py-3 rounded-xl bg-white border border-dark/5 flex items-center gap-3"
              >
                <AvatarCircle
                  name={requester?.name}
                  avatarColor={requester?.avatar_color}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-dark font-medium truncate">
                    {requester?.name || 'Unknown'}
                  </p>
                  <p
                    className="text-dark/40 text-xs"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Add Friend?
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium"
                    style={{
                      backgroundColor: '#c44829',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDecline(req.id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-dark/20 text-dark/60 font-medium"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Friends list */}
      {loading ? (
        [1, 2, 3].map(i => <Skeleton key={i} height="72px" borderRadius="12px" className="mx-5 my-1" />)
      ) : filteredFriends.length === 0 && acceptedFriends.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center px-8 py-20 text-center">
          <p
            className="italic text-xl mb-6 leading-relaxed"
            style={{
              fontFamily: "'Fraunces', serif",
              color: 'rgba(196, 72, 41, 0.6)',
            }}
          >
            No friends yet.{'\n'}Complete a quest near someone to connect.
          </p>
          <button
            onClick={() => navigate('/nearby')}
            className="text-sm tracking-widest uppercase border px-6 py-2 rounded-lg transition-colors"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              borderColor: '#c44829',
              color: '#c44829',
            }}
          >
            → Find nearby
          </button>
        </div>
      ) : filteredFriends.length === 0 && search ? (
        /* No search results */
        <div className="px-5 py-10 text-center">
          <p
            className="italic text-dark/40 text-lg"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            No friends match "{search}"
          </p>
        </div>
      ) : (
        filteredFriends.map(friend => (
          <div
            key={friend.friendshipId}
            className="mx-5 my-1 px-4 py-3 rounded-xl bg-paper border border-dark/5 flex items-center gap-3"
          >
            <AvatarCircle name={friend.name} avatarColor={friend.avatar_color} />
            <div className="flex-1 min-w-0">
              <p className="text-dark font-medium truncate">
                {friend.name || 'Unknown'}
              </p>
            </div>
            <span
              className="text-[10px] tracking-widest text-dark/40 flex-shrink-0"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              FRIEND
            </span>
          </div>
        ))
      )}
    </div>
  )
}
