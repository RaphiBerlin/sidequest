import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReactions } from '../hooks/useReactions'
import { checkText } from '../lib/moderation'
import QuestCard from './QuestCard'

const FEED_EMOJIS = ['🔥', '✨', '😂', '🙌', '🥲']

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m}m ago`
  return 'just now'
}

function UserAvatar({ user, size = 32 }) {
  const [imgErr, setImgErr] = useState(false)
  if (user?.avatar_url && !imgErr) {
    return (
      <img
        src={user.avatar_url}
        onError={() => setImgErr(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        alt={user.name}
      />
    )
  }
  const bg = user?.avatar_color || '#c44829'
  const initial = user?.name?.[0]?.toUpperCase() ?? '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#f4ede0', fontSize: size * 0.4, fontFamily: "'Fraunces', serif",
      fontStyle: 'italic', flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

export default function FeedCard({ session, currentUserId }) {
  const navigate = useNavigate()
  const { myReactions: mine, toggleReaction, grouped } = useReactions(session.id, currentUserId)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const inputRef = useRef(null)
  const commentsChannelRef = useRef(null)
  const [commentCount, setCommentCount] = useState(0)

  // Subscribe to new comments while sheet is open
  useEffect(() => {
    if (!sheetOpen || !session.id) return
    commentsChannelRef.current = supabase
      .channel(`comments-${session.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `session_id=eq.${session.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('comments')
          .select('id, body, created_at, user:users(name)')
          .eq('id', payload.new.id)
          .single()
        if (!data) return
        setComments(prev => {
          const optIdx = prev.findIndex(
            c => c.id?.toString().startsWith('opt-') && c.body === data.body && c.user?.name === 'You'
          )
          if (optIdx !== -1) {
            const next = [...prev]; next[optIdx] = data; return next
          }
          if (prev.find(c => c.id === data.id)) return prev
          return [...prev, data]
        })
      })
      .subscribe()
    return () => {
      if (commentsChannelRef.current) {
        supabase.removeChannel(commentsChannelRef.current)
        commentsChannelRef.current = null
      }
    }
  }, [sheetOpen, session.id])

  async function loadComments() {
    setCommentsLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, user:users(name)')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setCommentCount((data || []).length)
    setCommentsLoading(false)
  }

  function openSheet() {
    setSheetOpen(true)
    loadComments()
    setTimeout(() => inputRef.current?.focus(), 350)
  }

  function closeSheet() {
    setSheetOpen(false)
  }

  async function submitComment(e) {
    e.preventDefault()
    const body = commentText.trim()
    if (!body || submitting) return
    setCommentError('')
    const banned = await checkText(body)
    if (banned) { setCommentError("Your comment contains a word that isn't allowed."); return }
    setSubmitting(true)
    const optimistic = { id: `opt-${Date.now()}`, body, created_at: new Date().toISOString(), user: { name: 'You' } }
    setComments(prev => [...prev, optimistic])
    setCommentCount(c => c + 1)
    setCommentText('')
    const { error } = await supabase.from('comments').insert({ session_id: session.id, user_id: currentUserId, body })
    if (error) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      setCommentCount(c => c - 1)
      setCommentText(body)
    }
    setSubmitting(false)
  }

  const isOwnCard = session.user?.id && session.user.id === currentUserId

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Trading card */}
        <QuestCard session={session} width={260} />

        {/* Social strip */}
        <div style={{
          width: 260,
          background: '#f4ede0',
          borderLeft: '1px solid rgba(26,22,18,0.08)',
          borderRight: '1px solid rgba(26,22,18,0.08)',
          borderBottom: '1px solid rgba(26,22,18,0.08)',
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
        }}>
          {/* Avatar */}
          {!isOwnCard && session.user?.id ? (
            <button onClick={() => navigate(`/profile/${session.user.id}`)} style={{ flexShrink: 0, padding: 0 }}>
              <UserAvatar user={session.user} size={36} />
            </button>
          ) : (
            <div style={{ width: 36, flexShrink: 0 }} />
          )}

          {/* Reactions + 💬 inline */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            {FEED_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => toggleReaction(emoji)}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                  mine.has(emoji)
                    ? 'bg-rust/15 border border-rust/40 scale-110'
                    : grouped[emoji] > 0
                      ? 'bg-dark/5 border border-dark/15'
                      : 'border border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5'
                }`}
              >
                <span>{emoji}</span>
                {grouped[emoji] > 0 && (
                  <span className="text-dark/50 font-mono">{grouped[emoji]}</span>
                )}
              </button>
            ))}

            <button
              onClick={openSheet}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5 transition-all"
              style={{ marginLeft: 'auto' }}
            >
              <span>💬</span>
              {commentCount > 0 && (
                <span className="font-mono text-dark/50">{commentCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Comment sheet backdrop */}
      {sheetOpen && (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(26,22,18,0.45)',
          }}
        />
      )}

      {/* Comment bottom sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
        background: '#f4ede0',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '80vh',
        transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: '0 -4px 32px rgba(26,22,18,0.18)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(26,22,18,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '4px 16px 12px',
          borderBottom: '1px solid rgba(26,22,18,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: 'rgba(26,22,18,0.8)',
            fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.02em',
          }}>
            {commentCount === 1 ? '1 Comment' : `${commentCount} Comments`}
          </span>
          <button
            onClick={closeSheet}
            style={{ fontSize: 18, color: 'rgba(26,22,18,0.3)', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {commentsLoading ? (
            <p style={{ color: 'rgba(26,22,18,0.3)', fontSize: 12, fontFamily: 'monospace' }}>Loading…</p>
          ) : comments.length === 0 ? (
            <p style={{ color: 'rgba(26,22,18,0.3)', fontSize: 13, fontStyle: 'italic', fontFamily: "'Fraunces', serif" }}>
              No comments yet. Be the first.
            </p>
          ) : (
            comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(26,22,18,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: 'rgba(26,22,18,0.4)',
                  fontFamily: "'Fraunces', serif", fontStyle: 'italic',
                  flexShrink: 0,
                }}>
                  {c.user?.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <p style={{ fontSize: 13, color: 'rgba(26,22,18,0.8)', lineHeight: 1.4, margin: 0, paddingTop: 4 }}>
                  <strong style={{ fontWeight: 600, marginRight: 5, color: 'rgba(26,22,18,0.85)' }}>
                    {c.user?.name}
                  </strong>
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Error */}
        {commentError && (
          <p style={{ color: '#c44829', fontSize: 11, fontFamily: 'monospace', padding: '0 16px 4px' }}>
            {commentError}
          </p>
        )}

        {/* Input */}
        <form
          onSubmit={submitComment}
          style={{
            display: 'flex', gap: 8, padding: '10px 16px',
            borderTop: '1px solid rgba(26,22,18,0.08)',
            paddingBottom: `calc(10px + env(safe-area-inset-bottom, 0px))`,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={commentText}
            onChange={e => { setCommentText(e.target.value); setCommentError('') }}
            maxLength={500}
            placeholder="Add a comment…"
            style={{
              flex: 1, background: 'rgba(26,22,18,0.06)',
              border: '1px solid rgba(26,22,18,0.12)',
              borderRadius: 20, padding: '8px 14px',
              fontSize: 13, color: 'rgba(26,22,18,0.85)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="submit"
            disabled={!commentText.trim() || submitting}
            style={{
              fontSize: 12, color: '#c44829',
              border: '1px solid rgba(196,72,41,0.35)',
              borderRadius: 20, padding: '8px 14px',
              background: 'transparent', fontFamily: 'inherit',
              opacity: (!commentText.trim() || submitting) ? 0.3 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            Post
          </button>
        </form>
      </div>
    </>
  )
}
