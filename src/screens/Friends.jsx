import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getInviteLink } from '../lib/invites'
import { useToast } from '../context/ToastContext'
import Skeleton from '../components/Skeleton'
import Avatar from '../components/Avatar'
import { contactsSupported, getContactPhones, hashContactPhones, hashContactPhones as hashPhones } from '../lib/contacts'

async function sha256hex(str) {
  const data = new TextEncoder().encode(str)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 10) return '+1' + digits
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits
  if (digits.length > 7) return '+' + digits
  return null
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
  const [nameSearch, setNameSearch] = useState('')
  const [nameResults, setNameResults] = useState([])
  const [nameSearching, setNameSearching] = useState(false)
  const [phoneSearch, setPhoneSearch] = useState('')
  const [phoneSearching, setPhoneSearching] = useState(false)
  const [phoneResult, setPhoneResult] = useState(null) // null | 'not_found' | user object
  const [questCounts, setQuestCounts] = useState({})
  const channelRef = useRef(null)

  async function fetchFriendships() {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select(`
        id, status, tier, user_id, friend_id,
        requester:users!friendships_user_id_fkey(id, name, avatar_color, avatar_url),
        recipient:users!friendships_friend_id_fkey(id, name, avatar_color, avatar_url)
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

    // Fetch quest counts for accepted friends
    const friendIds = accepted.map(f => f.id)
    if (friendIds.length > 0) {
      const { data: sessions } = await supabase
        .from('quest_sessions')
        .select('user_id')
        .in('user_id', friendIds)
        .not('completed_at', 'is', null)
      const counts = {}
      sessions?.forEach(s => { counts[s.user_id] = (counts[s.user_id] || 0) + 1 })
      setQuestCounts(counts)
    }
  }

  useEffect(() => {
    if (!user) return
    fetchFriendships()

    // Incoming friend request (someone sent you one)
    const incomingChannel = supabase
      .channel('friendships-incoming')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friendships',
        filter: `friend_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.status !== 'pending') return
        // Fetch full row with requester details
        const { data } = await supabase
          .from('friendships')
          .select('id, status, tier, user_id, friend_id, requester:users!friendships_user_id_fkey(id, name, avatar_color, avatar_url), recipient:users!friendships_friend_id_fkey(id, name, avatar_color, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (data) setPendingRequests(prev => {
          if (prev.find(f => f.id === data.id)) return prev
          return [...prev, data]
        })
      })
      // Someone accepted a request you sent (you are user_id, status → accepted)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friendships',
        filter: `user_id=eq.${user.id}`,
      }, async (payload) => {
        if (payload.new.status !== 'accepted' || payload.old.status === 'accepted') return
        // Fetch with user details and move to accepted list
        const { data } = await supabase
          .from('friendships')
          .select('id, status, tier, user_id, friend_id, requester:users!friendships_user_id_fkey(id, name, avatar_color, avatar_url), recipient:users!friendships_friend_id_fkey(id, name, avatar_color, avatar_url)')
          .eq('id', payload.new.id)
          .single()
        if (!data) return
        const other = data.recipient
        setAcceptedFriends(prev => {
          if (prev.find(f => f.friendshipId === data.id)) return prev
          return [...prev, { friendshipId: data.id, ...other }]
        })
        showToast(`${other?.name ?? 'Someone'} accepted your friend request!`, 'success')
      })
      .subscribe()

    channelRef.current = incomingChannel
    return () => supabase.removeChannel(incomingChannel)
  }, [user])

  async function handleAccept(friendshipId) {
    const { data: friendship } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select('user_id')
      .single()
    // Notify the original requester that you accepted
    if (friendship?.user_id) {
      await supabase.from('notifications').insert({
        user_id: friendship.user_id,
        type: 'friend_accepted',
        from_user_id: user.id,
        data: {},
      })
    }
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
        await navigator.share({ title: 'Join me on Sidequest', text: 'Come quest with me!', url: link })
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

  async function searchByName() {
    if (!nameSearch.trim()) return
    setNameSearching(true)
    const { data } = await supabase.rpc('search_users', { query: nameSearch.trim() })
    setNameResults(data || [])
    setNameSearching(false)
  }

  async function searchByPhone() {
    const normalized = normalizePhone(phoneSearch)
    if (!normalized) return
    setPhoneSearching(true)
    setPhoneResult(null)
    const hash = await sha256hex(normalized)
    const { data } = await supabase
      .from('users')
      .select('id, name, avatar_url, avatar_color')
      .eq('phone_hash', hash)
      .neq('id', user.id)
      .maybeSingle()
    setPhoneResult(data || 'not_found')
    setPhoneSearching(false)
  }

  async function sendFriendRequest(friendId) {
    const { data: friendship } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: friendId, status: 'pending' })
      .select('id')
      .single()
    // Notify the recipient
    if (friendship?.id) {
      await supabase.from('notifications').insert({
        user_id: friendId,
        type: 'friend_request',
        from_user_id: user.id,
        data: { friendship_id: friendship.id },
      })
    }
    return friendship
  }

  async function sendRequest(friendId) {
    await sendFriendRequest(friendId)
    setNameResults(prev => prev.filter(u => u.id !== friendId))
    showToast('Friend request sent!', 'success')
  }

  async function addFromContacts(userId) {
    await sendFriendRequest(userId)
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

      {/* Search by name */}
      <div className="mx-5 mb-4 flex gap-2" style={{ width: 'calc(100% - 40px)' }}>
        <input
          placeholder="Find someone by name…"
          className="flex-1 bg-dark/5 rounded-lg px-4 py-2 text-dark/70 text-sm outline-none"
          value={nameSearch}
          onChange={e => setNameSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && searchByName()}
        />
        <button
          onClick={searchByName}
          disabled={nameSearching || !nameSearch.trim()}
          className="px-3 py-2 rounded-lg text-paper text-sm font-medium disabled:opacity-40 flex-shrink-0"
          style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {nameSearching ? '…' : 'Find'}
        </button>
      </div>

      {/* Name search results */}
      {nameResults.length > 0 && (
        <div className="mb-4">
          <p className="px-5 text-dark/40 text-xs tracking-widest uppercase mb-2"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Results
          </p>
          {nameResults.map(u => (
            <div key={u.id} className="mx-5 my-1 px-4 py-3 rounded-xl bg-white border border-dark/5 flex items-center gap-3">
              <Avatar src={u.avatar_url} name={u.name} color={u.avatar_color} size={48} />
              <div className="flex-1 min-w-0">
                <p className="text-dark font-medium truncate">{u.name}</p>
              </div>
              <button
                onClick={() => sendRequest(u.id)}
                className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium flex-shrink-0"
                style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {nameSearch && nameResults.length === 0 && !nameSearching && (
        <p className="px-5 mb-4 text-dark/30 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          No users found for "{nameSearch}".
        </p>
      )}

      {/* Find by phone number */}
      <div className="mx-5 mb-4 flex gap-2" style={{ width: 'calc(100% - 40px)' }}>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="Find by phone number…"
          className="flex-1 bg-dark/5 rounded-lg px-4 py-2 text-dark/70 text-sm outline-none"
          value={phoneSearch}
          onChange={e => { setPhoneSearch(e.target.value); setPhoneResult(null) }}
          onKeyDown={e => e.key === 'Enter' && searchByPhone()}
        />
        <button
          onClick={searchByPhone}
          disabled={phoneSearching || !normalizePhone(phoneSearch)}
          className="px-3 py-2 rounded-lg text-paper text-sm font-medium disabled:opacity-40 flex-shrink-0"
          style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
        >
          {phoneSearching ? '…' : 'Find'}
        </button>
      </div>
      {phoneResult && phoneResult !== 'not_found' && (
        <div className="mx-5 mb-4 px-4 py-3 rounded-xl bg-white border border-dark/5 flex items-center gap-3">
          <Avatar src={phoneResult.avatar_url} name={phoneResult.name} color={phoneResult.avatar_color} size={48} />
          <div className="flex-1 min-w-0">
            <p className="text-dark font-medium truncate">{phoneResult.name}</p>
          </div>
          <button
            onClick={() => { sendRequest(phoneResult.id); setPhoneResult(null); setPhoneSearch('') }}
            className="text-xs px-3 py-1.5 rounded-lg text-paper font-medium flex-shrink-0"
            style={{ backgroundColor: '#c44829', fontFamily: "'JetBrains Mono', monospace" }}
          >
            Add
          </button>
        </div>
      )}
      {phoneResult === 'not_found' && (
        <p className="px-5 mb-4 text-dark/30 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          No user found with that number.
        </p>
      )}

      {/* Find from contacts — Android Contact Picker API only */}
      {!contactsScanned && contactsSupported() && (
        <button
          onClick={findFromContacts}
          disabled={contactsLoading}
          className="mx-5 mb-4 w-[calc(100%-40px)] py-2.5 px-4 rounded-xl border border-dark/15 flex items-center gap-3 text-left hover:bg-dark/5 transition-colors disabled:opacity-40"
        >
          <span className="text-xl">📱</span>
          <div className="flex-1">
            <p className="text-dark text-sm font-medium" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
              {contactsLoading ? 'Scanning contacts…' : 'Find friends from contacts'}
            </p>
            <p className="text-dark/40 text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              See who's already on the app
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
              <Avatar src={match.avatar_url} name={match.name} color={match.avatar_color} size={48} />
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
                <Avatar
                  src={requester?.avatar_url}
                  name={requester?.name}
                  color={requester?.avatar_color}
                  size={48}
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
            Nobody here yet. Send a link and change that.
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
          <button
            key={friend.friendshipId}
            onClick={() => navigate(`/profile/${friend.id}`)}
            className="mx-5 my-1 px-4 py-3 rounded-xl bg-paper border border-dark/5 flex items-center gap-3 w-[calc(100%-40px)] text-left"
          >
            <Avatar src={friend.avatar_url} name={friend.name} color={friend.avatar_color} size={48} />
            <div className="flex-1 min-w-0">
              <p className="text-dark font-medium truncate">
                {friend.name || 'Unknown'}
              </p>
            </div>
            <span
              className="text-[10px] tracking-widest text-dark/40 flex-shrink-0 text-right leading-tight"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {questCounts[friend.id] ? `${questCounts[friend.id]} quests` : 'FRIEND'}
            </span>
          </button>
        ))
      )}
    </div>
  )
}
