import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

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
  const [reactions, setReactions] = useState(session.reactions || [])
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef(null)

  const grouped = FEED_EMOJIS.reduce((acc, e) => {
    acc[e] = reactions.filter(r => r.emoji === e).length
    return acc
  }, {})
  const mine = new Set(reactions.filter(r => r.user_id === currentUserId).map(r => r.emoji))

  async function toggleReaction(emoji) {
    if (mine.has(emoji)) {
      setReactions(prev => prev.filter(r => !(r.emoji === emoji && r.user_id === currentUserId)))
      await supabase.from('reactions').delete()
        .eq('session_id', session.id).eq('user_id', currentUserId).eq('emoji', emoji)
    } else {
      setReactions(prev => [...prev, { emoji, user_id: currentUserId }])
      await supabase.from('reactions').insert({ session_id: session.id, user_id: currentUserId, emoji })
    }
  }

  async function loadComments() {
    setCommentsLoading(true)
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, user:users(name)')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
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
    setSubmitting(true)
    const optimistic = { id: `opt-${Date.now()}`, body, created_at: new Date().toISOString(), user: { name: 'You' } }
    setComments(prev => [...prev, optimistic])
    setCommentText('')
    const { error } = await supabase.from('comments').insert({ session_id: session.id, user_id: currentUserId, body })
    if (error) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      setCommentText(body)
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-paper/5 border border-paper/10 rounded-2xl overflow-hidden mb-3">
      {session.photo_url && (
        <div className="h-56 bg-paper/10">
          <img
            src={`${session.photo_url}?width=600&quality=70`}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-full bg-rust/20 flex items-center justify-center text-rust text-xs font-medium flex-shrink-0 italic"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            {session.user?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-paper text-sm font-medium leading-tight">{session.user?.name}</p>
            <p className="text-paper/40 text-xs leading-tight truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {session.quest?.title}
            </p>
          </div>
          <p className="text-paper/30 text-xs flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {timeAgo(session.completed_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FEED_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => toggleReaction(emoji)}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                mine.has(emoji)
                  ? 'bg-rust/20 border border-rust/40'
                  : grouped[emoji] > 0
                    ? 'bg-paper/10 border border-paper/20'
                    : 'border border-paper/10 text-paper/30 hover:border-paper/30'
              }`}
            >
              <span>{emoji}</span>
              {grouped[emoji] > 0 && (
                <span className="text-paper/60 font-mono">{grouped[emoji]}</span>
              )}
            </button>
          ))}
          <button
            onClick={toggleComments}
            className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full text-xs border border-paper/10 text-paper/30 hover:border-paper/30 hover:text-paper/50 transition-all"
          >
            <span>💬</span>
            {comments.length > 0 && <span className="font-mono text-paper/50">{comments.length}</span>}
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-paper/10">
            {commentsLoading ? (
              <p className="text-paper/30 text-xs font-mono py-2">Loading…</p>
            ) : comments.length === 0 ? (
              <p className="text-paper/20 text-xs italic py-1" style={{ fontFamily: "'Fraunces', serif" }}>No comments yet.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2">
                    <div
                      className="w-5 h-5 rounded-full bg-paper/10 flex items-center justify-center text-paper/40 text-[10px] flex-shrink-0 mt-0.5 italic"
                      style={{ fontFamily: "'Fraunces', serif" }}
                    >
                      {c.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-paper/60 text-xs font-medium mr-1.5">{c.user?.name}</span>
                      <span className="text-paper/80 text-xs">{c.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={submitComment} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                maxLength={500}
                placeholder="Add a comment…"
                className="flex-1 bg-paper/5 border border-paper/15 rounded-full px-3 py-1.5 text-paper text-xs placeholder-paper/25 outline-none focus:border-paper/30 transition-colors"
                style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                className="text-xs text-rust border border-rust/30 rounded-full px-3 py-1.5 hover:bg-rust/10 transition-colors disabled:opacity-30"
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
