import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import FeedCard from '../components/FeedCard'

export default function Feed() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [feed, setFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(true)

  useEffect(() => {
    fetchFeed()
  }, [user])

  async function fetchFeed() {
    if (!user) return
    try {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted')

      const friendIds = friendships?.map(f =>
        f.user_id === user.id ? f.friend_id : f.user_id
      ) || []

      if (friendIds.length === 0) {
        setFeed([])
        setFeedLoading(false)
        return
      }

      const { data } = await supabase
        .from('quest_sessions')
        .select('id, completed_at, photo_url, user:users(id, name), quest:quests(title), reactions(emoji, user_id)')
        .in('user_id', friendIds)
        .not('completed_at', 'is', null)
        .order('completed_at', { ascending: false })
        .limit(20)

      setFeed(data || [])
    } catch (e) {
      console.error('feed error', e)
    } finally {
      setFeedLoading(false)
    }
  }

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
          Feed
        </h1>
        <button
          onClick={() => navigate('/friends')}
          className="mt-1 text-xs border border-dark/20 text-dark/40 px-3 py-1.5 rounded-full hover:border-dark/40 hover:text-dark/60 transition-colors"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Friends →
        </button>
      </div>

      {/* Feed */}
      <div className="px-5">
        {feedLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-dark/5 border border-dark/5 rounded-2xl overflow-hidden animate-pulse">
                <div className="h-48 bg-dark/10" />
                <div className="p-3 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-dark/10" />
                  <div className="flex-1">
                    <div className="h-3 bg-dark/10 rounded w-24 mb-1" />
                    <div className="h-2 bg-dark/10 rounded w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p
              className="italic text-xl mb-3 leading-relaxed"
              style={{ fontFamily: "'Fraunces', serif", color: 'rgba(196, 72, 41, 0.6)' }}
            >
              No activity yet.
            </p>
            <p
              className="text-dark/30 text-xs mb-6"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Add friends to see their quests here.
            </p>
            <button
              onClick={() => navigate('/friends')}
              className="text-sm tracking-widest uppercase border px-6 py-2 rounded-lg transition-colors"
              style={{ fontFamily: "'JetBrains Mono', monospace", borderColor: '#c44829', color: '#c44829' }}
            >
              → Find friends
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {feed.map(session => (
              <FeedCard key={session.id} session={session} currentUserId={user?.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
