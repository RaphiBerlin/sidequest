import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { writePresence, deletePresence } from '../lib/location'

export function useLocation() {
  const { user } = useAuth()
  const [location, setLocation] = useState(null) // { lat, lng }
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const didWriteRef = useRef(false)
  const autoTriedRef = useRef(false)

  async function requestLocation() {
    if (!user) return
    setLocationLoading(true)
    setLocationError(null)
    try {
      const coords = await writePresence(user.id)
      setLocation(coords)
      didWriteRef.current = true
    } catch (err) {
      setLocationError(err.message)
    } finally {
      setLocationLoading(false)
    }
  }

  // Auto-acquire location if permission was already granted — no prompt needed
  useEffect(() => {
    if (!user || autoTriedRef.current) return
    autoTriedRef.current = true

    if (!navigator.permissions) {
      // Permissions API not supported — try quietly and see if it works
      requestLocation()
      return
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      if (result.state === 'granted') {
        requestLocation()
      }
      // 'prompt' → wait for user to tap; 'denied' → do nothing
    }).catch(() => {
      // Permissions API failed — leave it to manual trigger
    })
  }, [user])

  // Clean up presence on unmount
  useEffect(() => {
    return () => {
      if (user && didWriteRef.current) {
        deletePresence(user.id)
      }
    }
  }, [user])

  return { location, locationError, locationLoading, requestLocation }
}
