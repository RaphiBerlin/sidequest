import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getInviteLink } from '../lib/invites'
import { useToast } from '../context/ToastContext'

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [locationSharing, setLocationSharing] = useState(
    localStorage.getItem('sq_location_sharing') !== 'false'
  )
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('users').select('name, streak, last_freeze_used_at, invite_code').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setProfile(data); setName(data.name || '') }
      })
  }, [user])

  async function saveName() {
    if (!name.trim()) return
    await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
    setProfile(prev => ({ ...prev, name: name.trim() }))
    setEditingName(false)
    showToast('Name updated', 'success')
  }

  async function copyInviteLink() {
    const link = await getInviteLink(user.id)
    await navigator.clipboard.writeText(link)
    showToast('Invite link copied!', 'success')
  }

  function toggleLocationSharing(val) {
    setLocationSharing(val)
    localStorage.setItem('sq_location_sharing', val ? 'true' : 'false')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  async function handleDeleteAccount() {
    await supabase.from('users').delete().eq('id', user.id)
    await signOut()
    navigate('/')
  }

  const freezeDate = profile?.last_freeze_used_at
    ? new Date(new Date(profile.last_freeze_used_at).getTime() + 7 * 24 * 60 * 60 * 1000)
    : null
  const freezeAvailable = !freezeDate || freezeDate < new Date()

  return (
    <div className="min-h-screen bg-paper pb-20" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-6">
        <button onClick={() => navigate(-1)} className="text-dark/40 text-xl">←</button>
        <h1 className="text-dark italic text-3xl" style={{ fontFamily: "'Fraunces', serif" }}>Settings</h1>
      </div>

      {/* Profile section */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Profile</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-rust flex items-center justify-center text-2xl text-paper font-bold">
              {name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1">
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    autoFocus
                    className="flex-1 bg-dark/5 rounded-lg px-3 py-1 text-dark text-sm outline-none border border-rust/30"
                  />
                  <button onClick={saveName} className="text-rust text-xs font-mono">Save</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-dark font-medium">{profile?.name || 'No name set'}</p>
                  <button onClick={() => setEditingName(true)} className="text-dark/30 text-xs font-mono border border-dark/10 px-2 py-0.5 rounded">Edit</button>
                </div>
              )}
              <p className="text-dark/40 text-sm mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Streak section */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Streak</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5 flex items-center justify-between">
          <div>
            <p className="text-dark font-medium">🔥 {profile?.streak || 0} day streak</p>
            <p className="text-dark/40 text-xs mt-0.5">
              {freezeAvailable ? 'Freeze available' : `Freeze resets ${freezeDate?.toLocaleDateString()}`}
            </p>
          </div>
          {freezeAvailable && <span className="text-xs font-mono border border-dark/20 text-dark/40 px-2 py-0.5 rounded-full">FREEZE READY</span>}
        </div>
      </section>

      {/* Invite section */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Invite Friends</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5">
          <p className="text-dark/60 text-sm mb-3">Share your personal invite link</p>
          <button
            onClick={copyInviteLink}
            className="w-full border border-rust/30 text-rust text-sm font-mono py-2 rounded-lg tracking-widest uppercase hover:bg-rust hover:text-dark transition-colors"
          >
            Copy invite link
          </button>
        </div>
      </section>

      {/* Preferences */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Preferences</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5 flex items-center justify-between">
          <div>
            <p className="text-dark text-sm font-medium">Location sharing</p>
            <p className="text-dark/40 text-xs">Share location during quests to find nearby friends</p>
          </div>
          <button
            onClick={() => toggleLocationSharing(!locationSharing)}
            className={`w-12 h-6 rounded-full transition-colors relative ${locationSharing ? 'bg-rust' : 'bg-dark/20'}`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${locationSharing ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>

      {/* About */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">About</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="text-dark text-sm">Sidequest</p>
            <p className="text-dark/40 text-xs font-mono">v{import.meta.env.VITE_APP_VERSION || '0.1.0'}</p>
          </div>
          <a href="mailto:berlinraphael@gmail.com?subject=Side/Quest Feedback" className="text-rust text-sm">Give feedback →</a>
          <button onClick={() => setShowInstallModal(true)} className="text-dark/60 text-sm text-left">How to install →</button>
        </div>
      </section>

      {/* Danger zone */}
      <section className="px-5">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Account</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-dark/5 flex flex-col gap-3">
          <button onClick={handleSignOut} className="w-full border border-dark/20 text-dark text-sm py-2 rounded-lg">Sign out</button>
          {showDeleteConfirm ? (
            <div className="flex gap-2">
              <button onClick={handleDeleteAccount} className="flex-1 bg-red-500 text-white text-sm py-2 rounded-lg">Confirm delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 border border-dark/20 text-dark text-sm py-2 rounded-lg">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)} className="text-red-400 text-xs font-mono text-center">Delete my account</button>
          )}
        </div>
      </section>

      {/* Install modal */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-dark/80 z-50 flex items-end" onClick={() => setShowInstallModal(false)}>
          <div className="bg-paper w-full rounded-t-3xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-dark italic text-xl mb-4" style={{ fontFamily: "'Fraunces', serif" }}>How to install</h3>
            <p className="text-dark/60 text-sm mb-2 font-medium">iPhone / Safari:</p>
            <p className="text-dark/60 text-sm mb-4">Tap the Share button → "Add to Home Screen" → Add</p>
            <p className="text-dark/60 text-sm mb-2 font-medium">Android / Chrome:</p>
            <p className="text-dark/60 text-sm mb-6">Tap the menu (⋮) → "Add to Home screen" → Install</p>
            <button onClick={() => setShowInstallModal(false)} className="w-full border border-dark/20 text-dark py-3 rounded-xl text-sm">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
