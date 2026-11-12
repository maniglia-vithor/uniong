import { useState, useEffect } from 'react'
import { User, Bell, Shield, Palette, Save, Eye, EyeOff, Download, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../services/api'

const ABAS = [
  { id: 'aparencia', label: 'Geral & Aparência', icon: Palette },
  { id: 'perfil',    label: 'Perfil',             icon: User },
  { id: 'notif',     label: 'Notificações',        icon: Bell },
  { id: 'privacidade', label: 'Privacidade & Dados', icon: Shield },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ backgroundColor: checked ? '#0f4c5c' : '#cbd5e1' }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 mt-0.5"
        style={{ marginLeft: checked ? '18px' : '2px' }}
      />
    </button>
  )
}

function Card({ title, children }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-4">
      {title && <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
      {children}
    </div>
  )
}

function Row({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        {desc && <p className="text-xs text-[var(--text-muted)] mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

// ── Carrega preferências salvas no localStorage ──────────────
function carregarPrefs() {
  try {
    return JSON.parse(localStorage.getItem('ong_prefs') ?? '{}')
  } catch {
    return {}
  }
}
function salvarPrefs(prefs) {
  localStorage.setItem('ong_prefs', JSON.stringify(prefs))
}

export default function Configuracoes() {
  const { usuario } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [aba, setAba] = useState('aparencia')

  // ── Aparência ────────────────────────────────────────────────
  const [densidade, setDensidade]   = useState('padrao')
  const [idioma, setIdioma]         = useState('pt-BR')

  // ── Perfil ──────────────────────────────────────────────────
  const [nome, setNome]             = useState('')
  const [email, setEmail]           = useState('')
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova]   = useState('')
  const [senhaConf, setSenhaConf]   = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [msgPerfil, setMsgPerfil]   = useState(null)

  // ── Notificações ─────────────────────────────────────────────
  const [notifDoacoes,    setNotifDoacoes]    = useState(true)
  const [notifCampanhas,  setNotifCampanhas]  = useState(true)
  const [notifMembros,    setNotifMembros]    = useState(true)
  const [notifDespesas,   setNotifDespesas]   = useState(true)

  // ── Privacidade ──────────────────────────────────────────────
  const [transparencia, setTransparencia] = useState(true)
  const [exportando, setExportando]       = useState(false)
  const [pix, setPix]                     = useState({ chave: '', nome_recebedor: '', cidade: '' })
  const [salvandoPix, setSalvandoPix]     = useState(false)

  useEffect(() => {
    api.get('/configuracoes/pix/').then(r => setPix(r.data)).catch(() => {})
  }, [])

  // Carrega prefs ao montar
  useEffect(() => {
    const p = carregarPrefs()
    if (p.densidade)       setDensidade(p.densidade)
    if (p.idioma)          setIdioma(p.idioma)
    if (p.notifDoacoes   !== undefined) setNotifDoacoes(p.notifDoacoes)
    if (p.notifCampanhas !== undefined) setNotifCampanhas(p.notifCampanhas)
    if (p.notifMembros   !== undefined) setNotifMembros(p.notifMembros)
    if (p.notifDespesas  !== undefined) setNotifDespesas(p.notifDespesas)
    if (p.transparencia  !== undefined) setTransparencia(p.transparencia)
    setNome(p.nome ?? usuario?.username ?? '')
    setEmail(p.email ?? '')
  }, [usuario])

  function salvarAparencia() {
    const p = { ...carregarPrefs(), densidade, idioma }
    salvarPrefs(p)
    setMsgPerfil({ tipo: 'ok', texto: 'Preferências salvas.' })
    setTimeout(() => setMsgPerfil(null), 3000)
  }

  function salvarNotificacoes() {
    salvarPrefs({ ...carregarPrefs(), notifDoacoes, notifCampanhas, notifMembros, notifDespesas })
    setMsgPerfil({ tipo: 'ok', texto: 'Preferências de notificação salvas.' })
    setTimeout(() => setMsgPerfil(null), 3000)
  }

  async function salvarPrivacidade() {
    salvarPrefs({ ...carregarPrefs(), transparencia })
    setSalvandoPix(true)
    try {
      const { data } = await api.put('/configuracoes/pix/', pix)
      setPix(data)
      setMsgPerfil({ tipo: 'ok', texto: 'Configurações de privacidade e chave PIX salvas.' })
    } catch {
      setMsgPerfil({ tipo: 'erro', texto: 'Erro ao salvar a chave PIX. Verifique os dados.' })
    } finally {
      setSalvandoPix(false)
      setTimeout(() => setMsgPerfil(null), 3000)
    }
  }

  async function salvarPerfil(e) {
    e.preventDefault()
    if (senhaNova && senhaNova !== senhaConf) {
      setMsgPerfil({ tipo: 'erro', texto: 'As senhas não coincidem.' })
      return
    }
    setSalvandoPerfil(true)
    try {
      const payload = {}
      if (senhaNova && senhaAtual) {
        payload.old_password = senhaAtual
        payload.new_password = senhaNova
        await api.post('/auth/change-password/', payload)
      }
      salvarPrefs({ ...carregarPrefs(), nome, email })
      setMsgPerfil({ tipo: 'ok', texto: 'Perfil atualizado com sucesso.' })
      setSenhaAtual(''); setSenhaNova(''); setSenhaConf('')
    } catch {
      setMsgPerfil({ tipo: 'erro', texto: 'Erro ao atualizar. Verifique os dados.' })
    } finally {
      setSalvandoPerfil(false)
      setTimeout(() => setMsgPerfil(null), 4000)
    }
  }

  async function exportarDados() {
    setExportando(true)
    try {
      const [doacoes, membros, campanhas] = await Promise.all([
        api.get('/doacoes/?page_size=9999'),
        api.get('/apoiadores/?page_size=9999'),
        api.get('/campanhas/?page_size=9999'),
      ])
      const dados = {
        exportado_em: new Date().toISOString(),
        doacoes: doacoes.data.results ?? doacoes.data,
        membros: membros.data.results ?? membros.data,
        campanhas: campanhas.data.results ?? campanhas.data,
      }
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `uniong_export_${new Date().toISOString().slice(0,10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Erro ao exportar dados.')
    } finally {
      setExportando(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 bg-[var(--bg-input)] text-[var(--text-primary)]'
  const selectCls = inputCls

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Configurações</h1>
        <p className="text-xs text-[var(--text-muted)]">Personalize o sistema e gerencie seu perfil</p>
      </div>

      {/* Feedback global */}
      {msgPerfil && (
        <div
          className={`text-sm px-4 py-2.5 rounded-lg font-medium ${
            msgPerfil.tipo === 'ok'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {msgPerfil.texto}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sub-nav vertical */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={aba === id
                ? { backgroundColor: 'rgba(15,76,92,0.08)', color: '#0f4c5c' }
                : { color: '#64748b' }}
            >
              <Icon size={16} style={aba === id ? { color: '#0f4c5c' } : { color: '#94a3b8' }} />
              {label}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div className="flex-1 space-y-4">

          {/* ── Aparência ── */}
          {aba === 'aparencia' && (
            <>
              <Card title="Aparência">
                <Row label="Tema" desc="Modo de cor da interface">
                  <div className="flex gap-2">
                    {[
                      { id: 'light', label: 'Claro',  Icon: Sun },
                      { id: 'dark',  label: 'Escuro', Icon: Moon },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        onClick={() => id !== theme && toggleTheme()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        style={theme === id
                          ? { borderColor: '#0f4c5c', color: '#0f4c5c', backgroundColor: 'rgba(15,76,92,0.08)' }
                          : { borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-card-alt)' }}
                      >
                        <Icon size={12} /> {label}
                      </button>
                    ))}
                  </div>
                </Row>
                <div className="border-t border-[var(--border-subtle)]" />
                <Row label="Densidade" desc="Espaçamento dos elementos">
                  <select value={densidade} onChange={e => setDensidade(e.target.value)} className={selectCls + ' w-auto'}>
                    <option value="compacto">Compacto</option>
                    <option value="padrao">Padrão</option>
                    <option value="grande">Grande</option>
                  </select>
                </Row>
                <div className="border-t border-[var(--border-subtle)]" />
                <Row label="Idioma" desc="Idioma da interface">
                  <select value={idioma} onChange={e => setIdioma(e.target.value)} className={selectCls + ' w-auto'}>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </Row>
              </Card>
              <div className="flex justify-end">
                <button
                  onClick={salvarAparencia}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#0f4c5c' }}
                >
                  <Save size={14} /> Salvar preferências
                </button>
              </div>
            </>
          )}

          {/* ── Perfil ── */}
          {aba === 'perfil' && (
            <form onSubmit={salvarPerfil} className="space-y-4">
              <Card title="Informações do perfil">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome de exibição</label>
                    <input className={inputCls} value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail</label>
                    <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Usuário (somente leitura)</label>
                    <input className={inputCls + ' bg-[var(--bg-card-alt)] text-[var(--text-muted)] cursor-not-allowed'} value={usuario?.username ?? ''} readOnly />
                  </div>
                </div>
              </Card>

              <Card title="Alterar senha">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Senha atual</label>
                    <div className="relative">
                      <input
                        className={inputCls + ' pr-9'}
                        type={mostrarSenha ? 'text' : 'password'}
                        value={senhaAtual}
                        onChange={e => setSenhaAtual(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={() => setMostrarSenha(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nova senha</label>
                      <input className={inputCls} type="password" value={senhaNova} onChange={e => setSenhaNova(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Confirmar</label>
                      <input className={inputCls} type="password" value={senhaConf} onChange={e => setSenhaConf(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Deixe em branco para manter a senha atual.</p>
                </div>
              </Card>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={salvandoPerfil}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#0f4c5c' }}
                >
                  <Save size={14} /> {salvandoPerfil ? 'Salvando...' : 'Salvar perfil'}
                </button>
              </div>
            </form>
          )}

          {/* ── Notificações ── */}
          {aba === 'notif' && (
            <>
              <Card title="Alertas em tempo real">
                <p className="text-xs text-[var(--text-muted)] -mt-2">Escolha quais eventos geram notificações no painel.</p>
                <div className="divide-y divide-[var(--border-subtle)]">
                  <Row label="Doações" desc="Nova doação registrada no sistema">
                    <Toggle checked={notifDoacoes} onChange={setNotifDoacoes} />
                  </Row>
                  <Row label="Campanhas" desc="Nova campanha criada ou encerrada">
                    <Toggle checked={notifCampanhas} onChange={setNotifCampanhas} />
                  </Row>
                  <Row label="Membros" desc="Novo membro cadastrado">
                    <Toggle checked={notifMembros} onChange={setNotifMembros} />
                  </Row>
                  <Row label="Despesas" desc="Nova despesa registrada">
                    <Toggle checked={notifDespesas} onChange={setNotifDespesas} />
                  </Row>
                </div>
              </Card>
              <div className="flex justify-end">
                <button
                  onClick={salvarNotificacoes}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: '#0f4c5c' }}
                >
                  <Save size={14} /> Salvar preferências
                </button>
              </div>
            </>
          )}

          {/* ── Privacidade & Dados ── */}
          {aba === 'privacidade' && (
            <>
              <Card title="Transparência pública">
                <Row
                  label="Portal de transparência ativo"
                  desc="Exibe dados financeiros agregados no portal público (/transparencia)"
                >
                  <Toggle checked={transparencia} onChange={setTransparencia} />
                </Row>
              </Card>

              <Card title="Chave PIX da instituição">
                <p className="text-xs text-[var(--text-muted)] -mt-2">
                  Usada para gerar o QR Code de doação das campanhas no portal de transparência.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Chave PIX</label>
                    <input
                      className={inputCls}
                      value={pix.chave}
                      onChange={e => setPix(p => ({ ...p, chave: e.target.value }))}
                      placeholder="CNPJ, e-mail, telefone (+55...) ou chave aleatória"
                      maxLength={77}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome do recebedor</label>
                      <input
                        className={inputCls}
                        value={pix.nome_recebedor}
                        onChange={e => setPix(p => ({ ...p, nome_recebedor: e.target.value }))}
                        placeholder="UniONG"
                        maxLength={25}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Cidade</label>
                      <input
                        className={inputCls}
                        value={pix.cidade}
                        onChange={e => setPix(p => ({ ...p, cidade: e.target.value }))}
                        placeholder="São Paulo"
                        maxLength={15}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Nome e cidade devem ser os mesmos cadastrados no banco (até 25 e 15 caracteres).
                  </p>
                </div>
              </Card>

              <Card title="Exportação de dados">
                <p className="text-xs text-[var(--text-muted)]">
                  Exporta todos os registros de doações, membros e campanhas em formato JSON.
                </p>
                <button
                  onClick={exportarDados}
                  disabled={exportando}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50"
                  style={{ borderColor: '#0f4c5c', color: '#0f4c5c' }}
                >
                  <Download size={14} /> {exportando ? 'Exportando...' : 'Exportar dados (JSON)'}
                </button>
              </Card>

              <div className="flex justify-end">
                <button
                  onClick={salvarPrivacidade}
                  disabled={salvandoPix}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: '#0f4c5c' }}
                >
                  <Save size={14} /> {salvandoPix ? 'Salvando...' : 'Salvar configurações'}
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
