import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function limparSessao() {
  localStorage.removeItem('ong_access')
  localStorage.removeItem('ong_refresh')
  localStorage.removeItem('ong_usuario')
  localStorage.removeItem('ong_role')
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(() => Boolean(localStorage.getItem('ong_access')))

  const carregarUsuario = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me/')
      if (!data.is_staff) throw new Error('sem acesso ao painel')
      setUsuario(data)
      return data
    } catch (err) {
      limparSessao()
      setUsuario(null)
      throw err
    }
  }, [])

  useEffect(() => {
    localStorage.removeItem('ong_usuario')
    localStorage.removeItem('ong_role')
    if (!localStorage.getItem('ong_access')) return
    carregarUsuario()
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [carregarUsuario])

  const entrarComTokens = useCallback(async (access, refresh) => {
    localStorage.setItem('ong_access', access)
    localStorage.setItem('ong_refresh', refresh)
    return carregarUsuario()
  }, [carregarUsuario])

  const login = useCallback(async (username, password) => {
    const { data } = await api.post('/auth/token/', { username, password })
    return entrarComTokens(data.access, data.refresh)
  }, [entrarComTokens])

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem('ong_refresh')
    limparSessao()
    setUsuario(null)
    if (refresh) {
      try { await api.post('/auth/logout/', { refresh }) } catch { /* sessão já encerrada no servidor */ }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, entrarComTokens, logout, atualizarUsuario: setUsuario, autenticado: !!usuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
