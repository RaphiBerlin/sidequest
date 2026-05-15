import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useReactions } from '../hooks/useReactions'
import { checkText } from '../lib/moderation'
import QuestCard from '../components/QuestCard'
import Avatar from '../components/Avatar'

const SESSION_SELECT = 'id, quest_id, completed_at, photo_url, elapsed_sec, xp_earned, party_ids, is_public, user:users(id, name, avatar_url, avatar_color, streak), quest:quests(title, description, xp, context_tags, duration_min), reactions(emoji, user_id)'

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

function formatElapsed(sec) {
  if (!sec) return null
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

export default function SessionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  const [comments, setComments] = useState([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [commentError, setCommentError] = useState('')
  const inputRef = useRef(null)
  const commentsChannelRef = useRef(null)

  const { grouped } = useReactions(id, user?.id)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('quest_sessions')
        .select(SESSION_SELECT)
        .eq('id', id)
        .single()
      setSession(data || null)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!id) return
    async function loadComments() {
      const { data } = await supabase
        .from('comments')
        .select('id, body, created_at, user:users(name)')
        .eq('session_id', id)
        .order('created_at', { ascending: true })
      setComments(data || [])
      setCommentsLoading(false)
    }
    loadComments()

    commentsChannelRef.current = supabase
      .channel(`comments-detail-${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `session_id=eq.${id}`,
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
  }, [id])

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
    setCommentText('')
    const { error } = await supabase.from('comments').insert({ session_id: id, user_id: user?.id, body })
    if (error) {
      setComments(prev => prev.filter(c => c.id !== optimistic.id))
      setCommentText(body)
    }
    setSubmitting(false)
  }

  const s = session

  return (
    <div className="min-h-screen pb-24" style={{ background: '#1a1612', fontFamily: "'Bricolage Grotesque', sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          style={{ color: 'rgba(244,237,224,0.5)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
        >
          ←
        </button>
        <h1
          className="italic text-2xl"
          style={{ fontFamily: "'Fraunces', serif", color: '#f4ede0' }}
        >
          {loading ? '' : s?.quest?.title || 'Quest'}
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center pt-8">
          <div style={{ width: 320, aspectRatio: '2.5/3.5', borderRadius: 14, background: 'rgba(244,237,224,0.07)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ) : !s ? (
        <div className="text-center py-20" style={{ color: 'rgba(244,237,224,0.4)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
          Session not found.
        </div>
      ) : (
        <>
          {/* Poster */}
          {s.user?.id && s.user.id !== user?.id && (
            <button
              onClick={() => navigate(`/profile/${s.user.id}`)}
              className="flex items-center gap-3 px-5 mb-4 w-full text-left"
            >
              <div style={{ borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                <Avatar src={s.user.avatar_url} name={s.user.name} color={s.user.avatar_color} size={32} />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'rgba(244,237,224,0.5)', letterSpacing: '0.04em' }}>
                {s.user.name}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(244,237,224,0.25)' }}>→</span>
            </button>
          )}

          {/* Card */}
          <div className="flex justify-center px-5 mb-6">
            <QuestCard session={s} />
          </div>

          {/* Meta strip */}
          <div className="px-5 mb-6 flex flex-wrap gap-2">
            {s.completed_at && (
              <Chip label="Completed" value={timeAgo(s.completed_at)} />
            )}
            {formatElapsed(s.elapsed_sec) && (
              <Chip label="Time" value={formatElapsed(s.elapsed_sec)} />
            )}
            {s.xp_earned != null && (
              <Chip label="XP" value={`+${s.xp_earned}`} accent />
            )}
            {s.party_ids?.length > 0 && (
              <Chip label="Co-questers" value={s.party_ids.length} />
            )}
            {FEED_EMOJIS.filter(e => grouped[e] > 0).map(emoji => (
              <Chip key={emoji} label={emoji} value={grouped[emoji]} />
            ))}
          </div>

          {/* Quest description */}
          {s.quest?.description && (
            <div className="px-5 mb-6">
              <p className="text-xs tracking-widest uppercase mb-2" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(244,237,224,0.35)' }}>Quest</p>
              <p className="leading-relaxed" style={{ color: 'rgba(244,237,224,0.75)', fontSize: 15 }}>
                {s.quest.description}
              </p>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(244,237,224,0.07)', margin: '0 0 24px' }} />

          {/* Comments */}
          <div className="px-5">
            <p className="text-xs tracking-widest uppercase mb-4" style={{ fontFamily: "'JetBrains Mono', monospace", color: 'rgba(244,237,224,0.35)' }}>
              Comments{comments.length > 0 ? ` · ${comments.length}` : ''}
            </p>

            {commentsLoading ? (
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(244,237,224,0.25)' }}>Loading…</p>
            ) : comments.length === 0 ? (
              <p className="italic mb-4" style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: 'rgba(244,237,224,0.25)' }}>
                No comments yet. Say something.
              </p>
            ) : (
              <div className="flex flex-col gap-4 mb-5">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 italic text-sm"
                      style={{ background: 'rgba(244,237,224,0.08)', color: 'rgba(244,237,224,0.4)', fontFamily: "'Fraunces', serif" }}
                    >
                      {c.user?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <span className="text-sm font-medium mr-2" style={{ color: 'rgba(244,237,224,0.6)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{c.user?.name}</span>
                      <span style={{ color: 'rgba(244,237,224,0.8)', fontSize: 14 }}>{c.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {commentError && (
              <p style={{ color: '#c44829', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, marginBottom: 8 }}>{commentError}</p>
            )}

            <form onSubmit={submitComment} className="flex gap-2 mt-2">
              <input
                ref={inputRef}
                type="text"
                value={commentText}
                onChange={e => { setCommentText(e.target.value); setCommentError('') }}
                maxLength={500}
                placeholder="Add a comment…"
                style={{
                  flex: 1,
                  background: 'rgba(244,237,224,0.06)',
                  border: '1px solid rgba(244,237,224,0.12)',
                  borderRadius: 99,
                  padding: '10px 16px',
                  fontSize: 14,
                  color: '#f4ede0',
                  outline: 'none',
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(244,237,224,0.25)'}
                onBlur={e => e.target.style.borderColor = 'rgba(244,237,224,0.12)'}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submitting}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color: '#c44829',
                  border: '1px solid rgba(196,72,41,0.35)',
                  borderRadius: 99,
                  padding: '10px 16px',
                  background: 'none',
                  cursor: 'pointer',
                  opacity: !commentText.trim() || submitting ? 0.35 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Post
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}

function Chip({ label, value, accent }) {
  return (
    <div style={{
      background: accent ? 'rgba(212,160,42,0.1)' : 'rgba(244,237,224,0.06)',
      border: `1px solid ${accent ? 'rgba(212,160,42,0.25)' : 'rgba(244,237,224,0.1)'}`,
      borderRadius: 10,
      padding: '6px 12px',
    }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: '0.1em', color: accent ? '#d4a02a' : 'rgba(244,237,224,0.35)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
      <p style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontSize: 16, color: accent ? '#d4a02a' : '#f4ede0' }}>{value}</p>
    </div>
  )
}
