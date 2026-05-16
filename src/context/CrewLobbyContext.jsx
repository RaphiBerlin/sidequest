import { createContext, useContext, useState } from 'react'

const CrewLobbyContext = createContext({ lobby: null, setLobby: () => {} })

export function CrewLobbyProvider({ children }) {
  const [lobby, setLobby] = useState(null) // { sessionId, activeQuest, invitedFriends }
  return (
    <CrewLobbyContext.Provider value={{ lobby, setLobby }}>
      {children}
    </CrewLobbyContext.Provider>
  )
}

export function useCrewLobby() {
  return useContext(CrewLobbyContext)
}
