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
import Historico from './pages/Historico'
import Equipe from './pages/Equipe'
import Voluntarios from './pages/Voluntarios'
import DefinirSenha from './pages/DefinirSenha'
import RecuperarSenha from './pages/RecuperarSenha'
import Descadastrar from './pages/Descadastrar'
import Transparencia from './pages/Transparencia'
import Privacidade from './pages/Privacidade'
import CampanhaPublica from './pages/CampanhaPublica'
import PrestacaoContasImpressao from './pages/PrestacaoContasImpressao'
import ReciboImpressao from './pages/ReciboImpressao'

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
          <Route path="/transparencia/campanha/:id" element={<CampanhaPublica />} />
          <Route path="/login" element={<Login />} />
          <Route path="/definir-senha/:uid/:token" element={<DefinirSenha modo="convite" />} />
          <Route path="/recuperar-senha" element={<RecuperarSenha />} />
          <Route path="/descadastrar/:token" element={<Descadastrar />} />
          <Route path="/redefinir-senha/:uid/:token" element={<DefinirSenha modo="redefinir" />} />

          {/* Rotas administrativas protegidas */}
          <Route element={<RotaProtegida />}>
            <Route path="/admin/relatorios/prestacao-contas" element={<PrestacaoContasImpressao />} />
            <Route path="/admin/doacoes/:id/recibo" element={<ReciboImpressao />} />
            <Route path="/admin" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="campanhas" element={<Campanhas />} />
              <Route path="doacoes" element={<Doacoes />} />
              <Route path="apoiadores" element={<Apoiadores />} />
              <Route path="comunicacao" element={<Comunicacao />} />
              <Route path="custos" element={<Custos />} />
              <Route path="voluntarios" element={<Voluntarios />} />
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="historico" element={<Historico />} />
              <Route path="equipe" element={<Equipe />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/transparencia" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ProvedorGoogle>
  )
}
