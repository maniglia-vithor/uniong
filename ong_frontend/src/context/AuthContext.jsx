import { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const salvo = localStorage.getItem('ong_usuario')
      return salvo ? JSON.parse(salvo) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })
    const dadosUsuario = { username, access: data.access, refresh: data.refresh }
    localStorage.setItem('ong_usuario', JSON.stringify(dadosUsuario))
    localStorage.setItem('ong_access', data.access)
    localStorage.setItem('ong_refresh', data.refresh)
    setUsuario(dadosUsuario)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ong_usuario')
    localStorage.removeItem('ong_access')
    localStorage.removeItem('ong_refresh')
    setUsuario(null)
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, login, logout, autenticado: !!usuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
