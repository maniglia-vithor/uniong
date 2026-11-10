import { createContext, useContext, useState } from 'react'

const RoleContext = createContext()

export function RoleProvider({ children }) {
  const [role, setRole] = useState(() => localStorage.getItem('ong_role') ?? 'admin')

  function switchRole(r) {
    localStorage.setItem('ong_role', r)
    setRole(r)
  }

  return (
    <RoleContext.Provider value={{ role, isAdmin: role === 'admin', switchRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export function useRole() {
  return useContext(RoleContext)
}
