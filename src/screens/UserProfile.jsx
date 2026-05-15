import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import QuestCard from '../components/QuestCard'

const CARD_W = 320
const CARD_H = CARD_W * (3.5 / 2.5)

// Friendship states: none | pending_sent | pending_received | friends
async function fetchFriendshipState(viewerId, targetId) {
  const { data } = await supabase
    .from('friendships')
    .select('id, status, user_id, friend_id')
    .or(
      `and(user_id.eq.${viewerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${viewerId})`
    )
    .single()

  if (!data) return { state: 'none', friendshipId: null }
  if (data.status === 'accepted') return { state: 'friends', friendshipId: data.id }
  if (data.status === 'pending') {
    return {
      state: data.user_id === viewerId ? 'pending_sent' : 'pending_received',
      friendshipId: data.id,
    }
  }
  return { state: 'none', friendshipId: null }
}

function ScaledCard({ session, cardUser, onClick }) {
  const wrapperRef = useRef(null)
  const [scale, setScale] = useState(null)

  useEffect(() => {
    if (!wrapperRef.current) return
    setScale(wrapperRef.current.offsetWidth / CARD_W)
  }, [])

  return (
    <div
      ref={wrapperRef}
      onClick={onClick}
      style={{ width: '100%', height: scale ? CARD_H * scale : 'auto', overflow: 'hidden', cursor: 'pointer', visibility: scale ? 'visible' : 'hidden' }}
    >
      {scale !== null && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CARD_W, pointerEvents: 'none' }}>
          <QuestCard session={{ ...session, user: cardUser, reactions: [] }} />
        </div>
      )}
    </div>
  )
}

function LockedBinder() {
  return (
    <div style={{ position: 'relative', padding: '0 12px' }}>
      {/* Ghost cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, filter: 'blur(3px)', opacity: 0.35 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ aspectRatio: '2.5/3.5', borderRadius: 10, background: 'rgba(244,237,224,0.08)', border: '1px solid rgba(212,160,42,0.15)' }} />
        ))}
      </div>
      {/* Lock overlay */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ fontSize: 28 }}>🔒</div>
        <p style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 15, color: 'rgba(244,237,224,0.6)', textAlign: 'center', padding: '0 24px', lineHeight: 1.4 }}>
          Become friends to see their quests
        </p>
      </div>
    </div>
  )
}

export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [friendship, setFriendship] = useState({ state: 'none', friendshipId: null })
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const isSelf = user?.id === userId

  useEffect(() => {
    if (isSelf) { navigate('/settings', { replace: true }); return }
    if (!user || !userId) return
    load()
  }, [user, userId])

  async function load() {
    setLoading(true)

    const [{ data: profileData }, friendshipResult] = await Promise.all([
      supabase.from('users').select('id, name, avatar_url, avatar_color, streak').eq('id', userId).single(),
      fetchFriendshipState(user.id, userId),
    ])

    setProfile(profileData)
    setFriendship(friendshipResult)

    if (friendshipResult.state === 'friends') {
      const { data } = await supabase
        .from('quest_sessions')
        .select('id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, quest:quest_id(title, description, xp, context_tags, duration_min)')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(30)
      setSessions(data || [])
    }

    setLoading(false)
  }

  async function sendRequest() {
    setActionLoading(true)
    const { data: f } = await supabase
      .from('friendships')
      .insert({ user_id: user.id, friend_id: userId, status: 'pending' })
      .select('id').single()
    if (f?.id) {
      await supabase.from('notifications').insert({
        user_id: userId, type: 'friend_request', from_user_id: user.id,
        data: { friendship_id: f.id },
      })
      setFriendship({ state: 'pending_sent', friendshipId: f.id })
    }
    setActionLoading(false)
  }

  async function acceptRequest() {
    setActionLoading(true)
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendship.friendshipId)
    await supabase.from('notifications').insert({
      user_id: userId, type: 'friend_accepted', from_user_id: user.id, data: {},
    })
    setFriendship({ state: 'friends', friendshipId: friendship.friendshipId })
    // Now load their sessions
    const { data } = await supabase
      .from('quest_sessions')
      .select('id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, quest:quest_id(title, description, xp, context_tags, duration_min)')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(30)
    setSessions(data || [])
    setActionLoading(false)
  }

  async function unfriend() {
    setActionLoading(true)
    await supabase.from('friendships').delete().eq('id', friendship.friendshipId)
    setFriendship({ state: 'none', friendshipId: null })
    setSessions([])
    setActionLoading(false)
  }

  const cardUser = {
    name: profile?.name || '?',
    avatar_url: profile?.avatar_url || null,
    avatar_color: profile?.avatar_color || '#c44829',
    streak: profile?.streak || 0,
  }

  const isFriends = friendship.state === 'friends'
  const sharedQuests = isFriends
    ? sessions.filter(s => s.party_ids?.includes(user.id)).length
    : 0

  return (
    <div className="min-h-screen pb-24" style={{ background: '#1a1612', fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} style={{ color: 'rgba(244,237,224,0.5)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
          ←
        </button>
      </div>

      {loading ? (
        <div className="px-5">
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(244,237,224,0.08)', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ width: 140, height: 20, borderRadius: 6, background: 'rgba(244,237,224,0.06)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ) : !profile ? (
        <div className="text-center py-20" style={{ color: 'rgba(244,237,224,0.3)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>User not found.</div>
      ) : (
        <>
          {/* Profile hero */}
          <div className="px-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div style={{ borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar src={profile.avatar_url} name={profile.name} color={profile.avatar_color} size={64} />
              </div>
              <div>
                <h1 className="italic text-3xl" style={{ fontFamily: "'Fraunces', serif", color: '#f4ede0', lineHeight: 1.1 }}>
                  {profile.name}
                </h1>
                {isFriends && profile.streak > 0 && (
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#d4a02a', marginTop: 4 }}>
                    🔥 {profile.streak} day streak
                  </p>
                )}
              </div>
            </div>

            {/* Friend action */}
            <div>
              {friendship.state === 'none' && (
                <button
                  onClick={sendRequest}
                  disabled={actionLoading}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
                    background: '#c44829', color: '#f4ede0', border: 'none',
                    borderRadius: 99, padding: '8px 16px', cursor: 'pointer',
                    opacity: actionLoading ? 0.5 : 1, textTransform: 'uppercase',
                  }}
                >
                  Add friend
                </button>
              )}
              {friendship.state === 'pending_sent' && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(244,237,224,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Request sent
                </span>
              )}
              {friendship.state === 'pending_received' && (
                <button
                  onClick={acceptRequest}
                  disabled={actionLoading}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
                    background: '#d4a02a', color: '#1a1612', border: 'none',
                    borderRadius: 99, padding: '8px 16px', cursor: 'pointer',
                    opacity: actionLoading ? 0.5 : 1, textTransform: 'uppercase',
                  }}
                >
                  Accept
                </button>
              )}
              {friendship.state === 'friends' && (
                <button
                  onClick={unfriend}
                  disabled={actionLoading}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
                    background: 'none', color: 'rgba(244,237,224,0.3)',
                    border: '1px solid rgba(244,237,224,0.15)',
                    borderRadius: 99, padding: '8px 16px', cursor: 'pointer',
                    opacity: actionLoading ? 0.5 : 1, textTransform: 'uppercase',
                  }}
                >
                  Friends ✓
                </button>
              )}
            </div>
          </div>

          {/* Stats — friends only */}
          {isFriends && (
            <div className="px-5 mb-6 grid grid-cols-3 gap-3">
              {[
                { label: 'Quests', value: sessions.length },
                { label: 'Streak', value: `${profile.streak}d` },
                { label: 'Together', value: sharedQuests },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'rgba(244,237,224,0.07)', border: '1px solid rgba(244,237,224,0.1)' }}>
                  <p className="text-xs mb-1 tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(244,237,224,0.4)', textTransform: 'uppercase' }}>{label}</p>
                  <p className="font-bold text-2xl" style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', color: '#f4ede0' }}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(244,237,224,0.07)', marginBottom: 20 }} />

          {/* Card binder or locked state */}
          {isFriends ? (
            sessions.length === 0 ? (
              <div className="text-center py-16">
                <p className="italic" style={{ fontFamily: "'Fraunces', serif", fontSize: 16, color: 'rgba(244,237,224,0.3)' }}>
                  {profile.name?.split(' ')[0]} hasn't completed any quests yet.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '0 12px' }}>
                {sessions.map(session => (
                  <ScaledCard
                    key={session.id}
                    session={session}
                    cardUser={cardUser}
                    onClick={() => navigate(`/session/${session.id}`)}
                  />
                ))}
              </div>
            )
          ) : (
            <LockedBinder />
          )}
        </>
      )}
    </div>
  )
}
