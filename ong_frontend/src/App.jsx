import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './context/AuthContext'
import RotaProtegida from './components/RotaProtegida'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Campanhas from './pages/Campanhas'
import Doacoes from './pages/Doacoes'
import Apoiadores from './pages/Apoiadores'
import Comunicacao from './pages/Comunicacao'
import Custos from './pages/Custos'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import Transparencia from './pages/Transparencia'

export default function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''}>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota raiz redireciona para o portal público */}
          <Route path="/" element={<Navigate to="/transparencia" replace />} />

          {/* Rotas públicas */}
          <Route path="/transparencia" element={<Transparencia />} />
          <Route path="/login" element={<Login />} />

          {/* Rotas administrativas protegidas */}
          <Route element={<RotaProtegida />}>
            <Route path="/admin" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="campanhas" element={<Campanhas />} />
              <Route path="doacoes" element={<Doacoes />} />
              <Route path="apoiadores" element={<Apoiadores />} />
              <Route path="comunicacao" element={<Comunicacao />} />
              <Route path="custos" element={<Custos />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/transparencia" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </GoogleOAuthProvider>
  )
}
