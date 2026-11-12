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
import Privacidade from './pages/Privacidade'
import PrestacaoContasImpressao from './pages/PrestacaoContasImpressao'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''

function ProvedorGoogle({ children }) {
  if (!GOOGLE_CLIENT_ID) return children
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>
}

export default function App() {
  return (
    <ProvedorGoogle>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rota raiz redireciona para o portal público */}
          <Route path="/" element={<Navigate to="/transparencia" replace />} />

          {/* Rotas públicas */}
          <Route path="/transparencia" element={<Transparencia />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/login" element={<Login />} />

          {/* Rotas administrativas protegidas */}
          <Route element={<RotaProtegida />}>
            <Route path="/admin/relatorios/prestacao-contas" element={<PrestacaoContasImpressao />} />
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
    </ProvedorGoogle>
  )
}
