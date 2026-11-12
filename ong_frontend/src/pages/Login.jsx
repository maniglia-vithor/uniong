import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import logoUniONG from '../assets/Gemini_Generated_Image_g792fng792fng792.jpg'

const GOOGLE_ATIVO = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

export default function Login() {
  const { login, entrarComTokens } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [carregandoGoogle, setCarregandoGoogle] = useState(false)
  const [erro, setErro] = useState(null)

  async function onGoogleSuccess({ credential }) {
    setCarregandoGoogle(true)
    setErro(null)
    try {
      const { data } = await axios.post('/api/auth/google/', { credential })
      await entrarComTokens(data.access, data.refresh)
      navigate('/admin', { replace: true })
    } catch (err) {
      setErro(err.response?.data?.erro ?? 'Falha ao autenticar com o Google. Tente novamente.')
    } finally {
      setCarregandoGoogle(false)
    }
  }

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
                <Link
                  to="/recuperar-senha"
                  className="text-xs transition-colors text-slate-500 hover:text-orange-600"
                >
                  Esqueci minha senha
                </Link>
              </div>
            </form>

            {GOOGLE_ATIVO && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-xs text-[var(--text-muted)] font-medium">OU</span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>

                <div className="flex justify-center">
                  {carregandoGoogle ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-2">
                      <div className="w-4 h-4 border-2 border-[var(--border)] border-t-[var(--text-secondary)] rounded-full animate-spin" />
                      Autenticando...
                    </div>
                  ) : (
                    <GoogleLogin
                      onSuccess={onGoogleSuccess}
                      onError={() => setErro('Login com Google cancelado ou falhou.')}
                      text="signin_with"
                      locale="pt-BR"
                      width="320"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-5">
            UniONG · Portal Unificado para Pequenas ONG's
          </p>
        </div>
      </div>
    </div>
  )
}
