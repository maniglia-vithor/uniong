import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import logoUniONG from '../assets/Gemini_Generated_Image_g792fng792fng792.jpg'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState(null)

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setCarregandoGoogle(true)
      setErro(null)
      try {
        // Troca o access_token do Google pelo id_token via userinfo
        const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        })
        // Envia o sub (id único) + email para o backend gerar JWT local
        const { data } = await axios.post('/api/auth/google/', {
          id_token: tokenResponse.access_token,
          email: userInfo.data.email,
          nome: userInfo.data.name,
        })
        const dadosUsuario = { username: data.username, access: data.access, refresh: data.refresh }
        localStorage.setItem('ong_usuario', JSON.stringify(dadosUsuario))
        localStorage.setItem('ong_access', data.access)
        localStorage.setItem('ong_refresh', data.refresh)
        navigate('/admin', { replace: true })
      } catch {
        setErro('Falha ao autenticar com o Google. Tente novamente.')
      } finally {
        setCarregandoGoogle(false)
      }
    },
    onError: () => setErro('Login com Google cancelado ou falhou.'),
  })

  function onChange(e) {
    setErro(null)
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setCarregando(true)
    setErro(null)
    try {
      await login(form.username, form.password)
      navigate('/admin', { replace: true })
    } catch (err) {
      if (err.response?.status === 401) {
        setErro('Usuário ou senha incorretos.')
      } else {
        setErro('Não foi possível conectar ao servidor. Tente novamente.')
      }
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2">

      {/* ── Coluna esquerda — Branding ── */}
      <div
        className="hidden md:flex flex-col items-center justify-center py-12 px-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0f4c5c 0%, #0a3340 60%, #072a35 100%)' }}
      >
        {/* Círculos decorativos teal */}
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        <div className="absolute bottom-10 -right-20 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-5"
          style={{ backgroundColor: '#ffffff' }} />

        {/* Centro: logo */}
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div
            className="rounded-3xl p-3 shadow-2xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <img
              src={logoUniONG}
              alt="UniONG"
              className="w-full max-w-lg object-contain rounded-2xl"
            />
          </div>
          <p className="text-white/60 text-sm text-center max-w-xs leading-relaxed">
            Gerencie campanhas, doações e membros<br />com transparência e eficiência.
          </p>
        </div>

        {/* Rodapé */}
        <p className="absolute bottom-5 text-white/25 text-xs z-10">
          © {new Date().getFullYear()} UniONG · Todos os direitos reservados
        </p>

        {/* Barra gradiente lateral direita */}
        <div
          className="absolute top-0 right-0 w-1 h-full"
          style={{ background: 'linear-gradient(to bottom, transparent, #f97316, transparent)' }}
        />
      </div>

      {/* ── Coluna direita — Formulário ── */}
      <div
        className="flex items-center justify-center p-8 relative"
        style={{ backgroundColor: '#f8fafc' }}
      >
        {/* Blob sutil no fundo */}
        <div
          className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0f4c5c, transparent)' }}
        />
        <div
          className="absolute top-0 left-0 w-48 h-48 rounded-full opacity-[0.05] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f97316, transparent)' }}
        />

        <div className="w-full max-w-sm relative z-10">

          {/* Logo mobile */}
          <div className="flex md:hidden flex-col items-center gap-3 mb-8">
            <img src={logoUniONG} alt="UniONG" className="w-24 h-24 object-contain" />
            <div className="text-center">
              <p className="font-bold text-slate-800">UniONG</p>
              <p className="text-xs text-slate-400">Portal Unificado para Pequenas ONG's</p>
            </div>
          </div>

          {/* Card */}
          <div className="bg-[var(--bg-card)] rounded-2xl shadow-xl p-8 border border-[var(--border)]">

            {/* Barra topo do card */}
            <div
              className="h-1 rounded-full mb-6"
              style={{ background: 'linear-gradient(to right, #0f4c5c, #f97316)' }}
            />

            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Bem-vindo de volta</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Acesse o painel administrativo</p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#0f4c5c' }}>
                  Usuário
                </label>
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={onChange}
                  placeholder="admin"
                  required
                  className="w-full px-3 py-2.5 text-sm border rounded-lg outline-none bg-[var(--bg-card-alt)] focus:bg-[var(--bg-input)] text-[var(--text-primary)] transition-colors"
                  style={{ borderColor: '#cbd5e1' }}
                  onFocus={e => { e.target.style.borderColor = '#0f4c5c'; e.target.style.boxShadow = '0 0 0 3px rgba(15,76,92,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#0f4c5c' }}>
                  Senha
                </label>
                <div className="relative">
                  <input
                    name="password"
                    type={mostrarSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={onChange}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2.5 pr-10 text-sm border rounded-lg outline-none bg-[var(--bg-card-alt)] focus:bg-[var(--bg-input)] text-[var(--text-primary)] transition-colors"
                    style={{ borderColor: '#cbd5e1' }}
                    onFocus={e => { e.target.style.borderColor = '#0f4c5c'; e.target.style.boxShadow = '0 0 0 3px rgba(15,76,92,0.1)' }}
                    onBlur={e => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#94a3b8' }}
                    tabIndex={-1}
                  >
                    {mostrarSenha ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600 font-medium">
                  {erro}
                </div>
              )}

              <button
                type="submit"
                disabled={carregando}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(to right, #0f4c5c, #0a3340)' }}
              >
                {carregando
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <LogIn size={15} />
                }
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="text-right -mt-1">
                <button
                  type="button"
                  className="text-xs transition-colors"
                  style={{ color: '#94a3b8' }}
                  onMouseEnter={e => e.target.style.color = '#f97316'}
                  onMouseLeave={e => e.target.style.color = '#94a3b8'}
                >
                  Esqueci minha senha?
                </button>
              </div>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">OU</span>
              <div className="flex-1 h-px bg-[var(--border)]" />
            </div>

            {/* Botão Google */}
            <button
              type="button"
              onClick={() => googleLogin()}
              disabled={carregandoGoogle}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors border disabled:opacity-60"
              style={{ color: 'var(--text-primary)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-card-alt)' }}
              onMouseEnter={e => { if (!carregandoGoogle) e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--bg-card-alt)'}
            >
              {carregandoGoogle ? (
                <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--text-secondary)] rounded-full animate-spin" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
              )}
              {carregandoGoogle ? 'Autenticando...' : 'Entrar com o Google'}
            </button>
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-5">
            UniONG · Portal Unificado para Pequenas ONG's
          </p>
        </div>
      </div>
    </div>
  )
}
