import { useState } from 'react'
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
        <div className="flex gap-1.5 flex-wrap">
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
        </div>
      </div>
    </div>
  )
}
