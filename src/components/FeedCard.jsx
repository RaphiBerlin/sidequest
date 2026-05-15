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

export default function FeedCard({ session, currentUserId }) {
  const navigate = useNavigate()
  const { myReactions: mine, toggleReaction, grouped } = useReactions(session.id, currentUserId)

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const inputRef = useRef(null)
  const commentsChannelRef = useRef(null)

  // Total comment count from initial reactions data isn't available, so track locally
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!showComments || !session.id) return
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
  }, [showComments, session.id])

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

  function toggleComments() {
    if (!showComments) {
      setShowComments(true)
      loadComments()
      setTimeout(() => inputRef.current?.focus(), 150)
    } else {
      setShowComments(false)
    }
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

  const totalReactions = Object.values(grouped).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Trading card */}
      <QuestCard session={session} />

      {/* Social strip */}
      <div
        style={{
          width: 320,
          background: '#f4ede0',
          borderLeft: '1px solid rgba(26,22,18,0.08)',
          borderRight: '1px solid rgba(26,22,18,0.08)',
          borderBottom: '1px solid rgba(26,22,18,0.08)',
          borderBottomLeftRadius: 10,
          borderBottomRightRadius: 10,
        }}
      >
        {/* User attribution */}
        {session.user?.id && session.user.id !== currentUserId && (
          <button
            onClick={() => navigate(`/profile/${session.user.id}`)}
            className="flex items-center gap-2 px-3 pt-2 pb-1 w-full text-left"
          >
            <span className="text-xs font-medium" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(26,22,18,0.45)', letterSpacing: '0.04em' }}>
              {session.user.name}
            </span>
            <span style={{ fontSize: 10, color: 'rgba(26,22,18,0.25)' }}>→</span>
          </button>
        )}

        {/* Reactions + comment toggle */}
        <div className="flex items-center gap-1.5 flex-wrap px-3 py-2">
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
            onClick={toggleComments}
            className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-all ${
              showComments
                ? 'bg-dark/8 border-dark/25 text-dark/60'
                : 'border-dark/10 text-dark/30 hover:border-dark/25 hover:bg-dark/5'
            }`}
          >
            <span>💬</span>
            {commentCount > 0 && (
              <span className="font-mono text-dark/50">{commentCount}</span>
            )}
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="px-3 pb-3 pt-1 border-t border-dark/8">
            {commentsLoading ? (
              <p className="text-dark/30 text-xs font-mono py-2">Loading…</p>
            ) : comments.length === 0 ? (
              <p className="text-dark/25 text-xs italic py-1" style={{ fontFamily: "'Fraunces', serif" }}>
                No comments yet. Say something.
              </p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div
                      className="w-5 h-5 rounded-full bg-dark/10 flex items-center justify-center text-dark/40 text-[10px] flex-shrink-0 mt-0.5 italic"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      {c.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-dark/50 text-xs font-medium mr-1.5">{c.user?.name}</span>
                      <span className="text-dark/80 text-xs">{c.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {commentError && (
              <p className="text-red-400 text-xs font-mono mb-2">{commentError}</p>
            )}
            <form onSubmit={submitComment} className="flex gap-2 mt-1">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => { setCommentText(e.target.value); setCommentError('') }}
                maxLength={500}
                placeholder="Add a comment…"
                className="flex-1 bg-dark/5 border border-dark/10 rounded-full px-3 py-1.5 text-dark text-xs placeholder-dark/25 outline-none focus:border-dark/25 transition-colors"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="text-xs text-rust border border-rust/30 rounded-full px-3 py-1.5 hover:bg-rust/8 transition-colors disabled:opacity-30"
              >
                Post
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
