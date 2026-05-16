import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { getInviteLink } from '../lib/invites'
import { checkText } from '../lib/moderation'
import { useToast } from '../context/ToastContext'
import Avatar from '../components/Avatar'

/** Compress + resize an image File/Blob to a square JPEG Blob. */
async function resizeAvatar(file, size = 400) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      // Centre-crop to square
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
      URL.revokeObjectURL(url)
      canvas.toBlob(resolve, 'image/jpeg', 0.82)
    }
    img.src = url
  })
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const fileInputRef = useRef(null)

  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [locationSharing, setLocationSharing] = useState(
    localStorage.getItem('sq_location_sharing') !== 'false'
  )
  const [showInstallModal, setShowInstallModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [usingFreeze, setUsingFreeze] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarColor, setAvatarColor] = useState('#c44829')

  useEffect(() => {
    if (!user) return
    supabase
      .from('users')
      .select('name, streak, last_freeze_used_at, invite_code, avatar_url, avatar_color')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setName(data.name || '')
          setAvatarUrl(data.avatar_url || null)
          setAvatarColor(data.avatar_color || '#c44829')
        }
      })
  }, [user])

  async function saveName() {
    if (!name.trim()) return
    const banned = await checkText(name.trim())
    if (banned) {
      showToast('That name contains a word that isn\'t allowed.', 'error')
      return
    }
    await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
    setProfile(prev => ({ ...prev, name: name.trim() }))
    setEditingName(false)
    showToast('Name updated', 'success')
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const blob = await resizeAvatar(file)
      const path = `avatars/${user.id}.jpg`
      const { error } = await supabase.storage
        .from('quest-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('quest-photos').getPublicUrl(path)
      // Cache-bust so the browser picks up the new image
      const url = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('users').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      setAvatarUrl(url)
      showToast('Profile photo updated', 'success')
    } catch {
      showToast('Upload failed — try again', 'error')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  async function removeAvatar() {
    setUploadingAvatar(true)
    try {
      await supabase.storage.from('quest-photos').remove([`avatars/${user.id}.jpg`])
      await supabase.from('users').update({ avatar_url: null }).eq('id', user.id)
      setAvatarUrl(null)
      showToast('Photo removed', 'success')
    } catch {
      showToast('Could not remove photo', 'error')
    } finally {
      setUploadingAvatar(false)
    }
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

  async function useFreeze() {
    setUsingFreeze(true)
    await supabase.from('users').update({ last_freeze_used_at: new Date().toISOString() }).eq('id', user.id)
    setProfile(prev => ({ ...prev, last_freeze_used_at: new Date().toISOString() }))
    setUsingFreeze(false)
    showToast('Streak frozen for 24h ❄️', 'success')
  }

  async function handleDeleteAccount() {
    await supabase.rpc('delete_account')
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

          {/* Avatar centred with pencil icon */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar src={avatarUrl} name={name || user?.email} color={avatarColor} size={80} />

              {/* Pencil icon — bottom-right */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-dark text-paper flex items-center justify-center shadow-md hover:bg-rust transition-colors disabled:opacity-40 focus:outline-none"
                aria-label="Upload profile photo"
              >
                {uploadingAvatar
                  ? <span className="text-[10px] font-mono">…</span>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                }
              </button>
            </div>

            {/* Name + email */}
            <div className="text-center">
              {editingName ? (
                <div className="flex gap-2 items-center">
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={saveName}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    autoFocus
                    className="bg-dark/5 rounded-lg px-3 py-1 text-dark text-sm outline-none border border-rust/30 text-center"
                  />
                  <button onClick={saveName} className="text-rust text-xs font-mono">Save</button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-dark font-medium text-base hover:text-rust transition-colors"
                >
                  {profile?.name || 'No name set'}
                </button>
              )}
              <p className="text-dark/40 text-sm mt-0.5">{user?.email}</p>
            </div>

            {/* Remove photo link — only when a photo exists */}
            {avatarUrl && (
              <button
                onClick={removeAvatar}
                disabled={uploadingAvatar}
                className="text-dark/30 text-xs font-mono hover:text-red-400 transition-colors disabled:opacity-40"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarFile}
      />

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
          {freezeAvailable && (
            <button
              onClick={useFreeze}
              disabled={usingFreeze}
              className="text-xs font-mono border border-blue-300 text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-40"
            >
              {usingFreeze ? '…' : '❄️ Use freeze'}
            </button>
          )}
        </div>
      </section>

      {/* Friends */}
      <section className="px-5 mb-6">
        <p className="text-dark/40 text-xs font-mono tracking-widest uppercase mb-3">Friends</p>
        <div className="bg-white rounded-2xl shadow-sm border border-dark/5 overflow-hidden">
          <button
            onClick={() => navigate('/friends')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark/5 transition-colors"
          >
            <span className="text-dark text-sm">My friends</span>
            <span className="text-dark/30 text-sm">→</span>
          </button>
          <div className="border-t border-dark/5">
            <button
              onClick={copyInviteLink}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-dark/5 transition-colors"
            >
              <span className="text-dark text-sm">Invite a friend</span>
              <span className="text-dark/30 text-sm">↗</span>
            </button>
          </div>
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
            className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${locationSharing ? 'bg-rust' : 'bg-dark/20'}`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${locationSharing ? 'translate-x-6' : 'translate-x-0'}`} />
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
          <a href="mailto:berlinraphael@gmail.com?subject=Sidequest Feedback" className="text-rust text-sm">Give feedback →</a>
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
