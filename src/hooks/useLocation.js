import { useState, useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import { writePresence, deletePresence } from '../lib/location'

export function useLocation() {
  const { user } = useAuth()
  const [location, setLocation] = useState(null) // { lat, lng }
  const [locationError, setLocationError] = useState(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const didWriteRef = useRef(false)

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
