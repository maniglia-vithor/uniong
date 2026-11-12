import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Megaphone, HandCoins, Users,
  MessageSquare, Receipt, BarChart3, Bell, LogOut, Check, X, Settings,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

import api, { buscarTodas } from '../services/api'
import logoIcon from '../assets/Gemini_Generated_Image_g792fng792fng792.jpg'
import RecordDetailDrawer, { TIPOS_COM_DETALHE } from './RecordDetailDrawer'

const navItems = [
  { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/admin/campanhas', label: 'Campanhas', icon: Megaphone },
  { to: '/admin/doacoes', label: 'Doações', icon: HandCoins },
  { to: '/admin/apoiadores', label: 'Membros', icon: Users },
  { to: '/admin/comunicacao', label: 'Comunicação', icon: MessageSquare },
  { to: '/admin/custos', label: 'Custos', icon: Receipt },
  { to: '/admin/relatorios', label: 'Relatórios', icon: BarChart3 },
]

const titulos = {
  '/admin': { titulo: 'Painel Principal', sub: 'Visão geral da organização' },
  '/admin/campanhas': { titulo: 'Campanhas', sub: 'Gerencie as campanhas de arrecadação' },
  '/admin/doacoes': { titulo: 'Doações', sub: 'Histórico de doações' },
  '/admin/apoiadores': { titulo: 'Membros', sub: 'Gerencie os membros da organização' },
  '/admin/comunicacao': { titulo: 'Comunicação', sub: 'Mensagens e notificações' },
  '/admin/custos': { titulo: 'Custos', sub: 'Gestão de despesas e transparência financeira' },
  '/admin/relatorios': { titulo: 'Relatórios', sub: 'Análises e exportações' },
  '/admin/configuracoes': { titulo: 'Configurações', sub: 'Preferências e gerenciamento do sistema' },
}

const tipoBadge = {
  doacao:   { label: 'Doação',   bg: '#dcfce7', color: '#16a34a' },
  campanha: { label: 'Campanha', bg: '#dbeafe', color: '#2563eb' },
  apoiador: { label: 'Membro', bg: '#f3e8ff', color: '#7c3aed' },
  despesa:  { label: 'Despesa',  bg: '#fee2e2', color: '#dc2626' },
  configuracao: { label: 'Configuração', bg: '#e2e8f0', color: '#475569' },
}

function formatarTempo(isoStr) {
  const diff = Math.floor((Date.now() - new Date(isoStr)) / 1000)
  if (diff < 60) return 'agora mesmo'
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function iniciais(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const avatarCores = ['#0f4c5c', '#f97316', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
function avatarCor(nome = '') {
  let h = 0
  for (let i = 0; i < nome.length; i++) h = (h + nome.charCodeAt(i)) % avatarCores.length
  return avatarCores[h]
}

export default function Layout() {
  const { pathname } = useLocation()
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const paginaAtual = titulos[pathname] || titulos['/admin']

  const [notificacoes, setNotificacoes] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('todas')
  const [filtroTipo, setFiltroTipo] = useState(null)
  const [aberto, setAberto] = useState(false)
  const [drawerTarget, setDrawerTarget] = useState(null)
  const dropdownRef = useRef(null)

  const naoLidas = notificacoes.filter(n => !n.lida).length

  const [pendentes, setPendentes] = useState(0)

  const buscarNotificacoes = useCallback(async () => {
    try {
      const [lista, resumo] = await Promise.all([
        buscarTodas('/notificacoes/'),
        api.get('/doacoes/resumo/', { params: { status: 'pendente' } }),
      ])
      setNotificacoes(lista)
      setPendentes(resumo.data.quantidade)
    } catch { /* silencia erros de polling */ }
  }, [])

  useEffect(() => {
    buscarNotificacoes()
    const intervalo = setInterval(buscarNotificacoes, 20000)
    window.addEventListener('doacoes-pendentes-alteradas', buscarNotificacoes)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('doacoes-pendentes-alteradas', buscarNotificacoes)
    }
  }, [buscarNotificacoes])

  useEffect(() => {
    function handleClickFora(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickFora)
    return () => document.removeEventListener('mousedown', handleClickFora)
  }, [])

  async function marcarTodasLidas() {
    await api.post('/notificacoes/marcar-todas-lidas/')
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })))
  }

  async function clicarNotificacao(n) {
    // marca como lida
    if (!n.lida) {
      await api.patch(`/notificacoes/${n.id}/`, { lida: true })
      setNotificacoes(prev => prev.map(x => x.id === n.id ? { ...x, lida: true } : x))
    }
    setAberto(false)
    // abre drawer se tem target_type e target_id
    if (n.target_id && TIPOS_COM_DETALHE.includes(n.target_type)) {
      setDrawerTarget({ type: n.target_type, id: n.target_id })
    }
  }

  async function remover(e, id) {
    e.stopPropagation()
    await api.delete(`/notificacoes/${id}/`)
    setNotificacoes(prev => prev.filter(n => n.id !== id))
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const lista = notificacoes
    .filter(n => abaAtiva === 'nao_lidas' ? !n.lida : true)
    .filter(n => filtroTipo ? n.tipo === filtroTipo : true)

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#0f4c5c' }}>
          {/* Branding */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
            <img
              src={logoIcon}
              alt="UniONG"
              className="w-9 h-9 rounded-lg object-contain flex-shrink-0"
            />
            <div>
              <p className="text-white font-bold text-sm leading-tight">UniONG</p>
              <p className="text-white/50 text-xs">Painel Administrativo</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-white/55 hover:bg-white/10 hover:text-white'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { backgroundColor: 'rgba(249,115,22,0.22)' } : {}
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                        style={{ backgroundColor: '#f97316' }}
                      />
                    )}
                    <Icon size={18} style={isActive ? { color: '#f97316' } : {}} />
                    {label}
                    {to === '/admin/doacoes' && pendentes > 0 && (
                      <span
                        className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                        style={{ backgroundColor: '#f97316' }}
                        aria-label={`${pendentes} doações pendentes`}
                      >
                        {pendentes > 99 ? '99+' : pendentes}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Usuário logado */}
          <div className="px-4 py-4 border-t border-white/10 space-y-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#f97316' }}
              >
                {iniciais(usuario?.nome || usuario?.username || '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{usuario?.nome || usuario?.username}</p>
                <p className="text-white/40 text-xs">{usuario?.is_superuser ? 'Administrador' : 'Equipe'}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white text-xs font-medium"
            >
              <LogOut size={14} />
              Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Topbar */}
          <header className="bg-[var(--bg-card)] border-b border-[var(--border)] px-6 py-3.5 flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-base font-semibold text-[var(--text-primary)]">{paginaAtual.titulo}</h1>
              <p className="text-xs text-[var(--text-muted)]">{paginaAtual.sub}</p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate('/admin/configuracoes')}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
                title="Configurações"
              >
                <Settings size={18} className="text-[var(--text-muted)]" />
              </button>

            {/* Bell */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setAberto(v => !v)}
                className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Bell size={18} className="text-[var(--text-muted)]" />
                {naoLidas > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    {naoLidas > 99 ? '99+' : naoLidas}
                  </span>
                )}
              </button>

              {/* Dropdown */}
              {aberto && (
                <div
                  className="absolute right-0 top-11 w-96 bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border)] z-50 flex flex-col overflow-hidden"
                  style={{ maxHeight: '520px' }}
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
                    <span className="font-semibold text-[var(--text-primary)] text-sm">Notificações</span>
                    {naoLidas > 0 && (
                      <button
                        onClick={marcarTodasLidas}
                        className="flex items-center gap-1 text-xs font-medium transition-colors"
                        style={{ color: '#0f4c5c' }}
                      >
                        <Check size={13} />
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  {/* Abas lidas/não lidas */}
                  <div className="flex border-b border-[var(--border)] flex-shrink-0">
                    {[
                      { id: 'todas', label: 'Todas' },
                      { id: 'nao_lidas', label: `Não lidas${naoLidas > 0 ? ` (${naoLidas})` : ''}` },
                    ].map(aba => (
                      <button
                        key={aba.id}
                        onClick={() => setAbaAtiva(aba.id)}
                        className="flex-1 py-2 text-xs font-medium transition-colors border-b-2"
                        style={{
                          borderColor: abaAtiva === aba.id ? '#0f4c5c' : 'transparent',
                          color: abaAtiva === aba.id ? '#0f4c5c' : '#94a3b8',
                        }}
                      >
                        {aba.label}
                      </button>
                    ))}
                  </div>

                  {/* Pills de categoria */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[var(--border)] flex-shrink-0 overflow-x-auto">
                    <button
                      onClick={() => setFiltroTipo(null)}
                      className="whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors flex-shrink-0"
                      style={filtroTipo === null
                        ? { backgroundColor: '#0f4c5c', color: '#fff' }
                        : { backgroundColor: '#f1f5f9', color: '#64748b' }}
                    >
                      Todos
                    </button>
                    {Object.entries(tipoBadge).map(([tipo, b]) => {
                      const count = notificacoes.filter(n => n.tipo === tipo && (abaAtiva === 'nao_lidas' ? !n.lida : true)).length
                      if (count === 0) return null
                      const ativo = filtroTipo === tipo
                      return (
                        <button
                          key={tipo}
                          onClick={() => setFiltroTipo(ativo ? null : tipo)}
                          className="whitespace-nowrap text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors flex-shrink-0 flex items-center gap-1"
                          style={ativo
                            ? { backgroundColor: b.color, color: '#fff' }
                            : { backgroundColor: b.bg, color: b.color }}
                        >
                          {b.label}
                          <span className="opacity-70">{count}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Lista estilo Jira */}
                  <div className="overflow-y-auto flex-1">
                    {lista.length === 0 ? (
                      <div className="py-12 text-center">
                        <Bell size={32} className="mx-auto mb-3 text-slate-200" />
                        <p className="text-sm text-[var(--text-muted)]">Nenhuma notificação</p>
                      </div>
                    ) : (
                      lista.map(n => {
                        const actor = n.actor_name || 'Sistema'
                        const cor = avatarCor(actor)
                        return (
                          <button
                            key={n.id}
                            onClick={() => clicarNotificacao(n)}
                            className="w-full text-left flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-subtle)] group relative"
                            style={{ backgroundColor: n.lida ? 'var(--bg-card)' : 'var(--bg-card-alt)' }}
                          >
                            {/* Avatar */}
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: cor }}
                            >
                              {iniciais(actor)}
                            </div>

                            {/* Texto */}
                            <div className="flex-1 min-w-0 pr-4">
                              <p className="text-xs text-[var(--text-secondary)] leading-snug">
                                <span className="font-semibold text-[var(--text-primary)]">{actor}</span>
                                {' '}
                                {n.action_text || n.mensagem}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                {(() => {
                                  const b = tipoBadge[n.tipo] ?? { label: n.tipo, bg: '#f1f5f9', color: '#64748b' }
                                  return (
                                    <span
                                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                      style={{ backgroundColor: b.bg, color: b.color }}
                                    >
                                      {b.label}
                                    </span>
                                  )
                                })()}
                                <span className="text-[11px] text-[var(--text-muted)]">{formatarTempo(n.criada_em)}</span>
                              </div>
                            </div>

                            {/* Indicador não lida */}
                            {!n.lida && (
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5"
                                style={{ backgroundColor: '#3b82f6' }}
                              />
                            )}

                            {/* Botão remover */}
                            <button
                              onClick={e => remover(e, n.id)}
                              className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-all"
                            >
                              <X size={12} className="text-[var(--text-muted)]" />
                            </button>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6 bg-[var(--bg-page)]">
            <Outlet context={{ openDrawer: setDrawerTarget }} />
          </main>
        </div>
      </div>

      {/* Record Detail Drawer */}
      <RecordDetailDrawer
        target={drawerTarget}
        onClose={() => setDrawerTarget(null)}
        onRefresh={() => {}}
      />
    </>
  )
}
