import { useCallback, useState, useEffect } from 'react'
import { User, Shield, Palette, Save, Eye, EyeOff, Download, Sun, Moon, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api, { buscarTodas } from '../services/api'
import { mensagemErro } from '../utils/formatos'
import FormInstituicao from '../components/FormInstituicao'

const ABAS = [
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'perfil', label: 'Perfil', icon: User },
  { id: 'privacidade', label: 'Privacidade & Dados', icon: Shield },
  { id: 'instituicao', label: 'Instituição', icon: Building2, soSuperusuario: true },
]

const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 bg-[var(--bg-input)] text-[var(--text-primary)] disabled:opacity-60'
const botaoPrimario = 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50'

function Toggle({ checked, onChange, disabled, rotulo }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={rotulo}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: checked ? '#0f4c5c' : '#94a3b8' }}
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
    <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-4">
      {title && <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>}
      {children}
    </section>
  )
}

function CampoTexto({ id, rotulo, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{rotulo}</label>
      <input id={id} className={inputCls} {...props} />
    </div>
  )
}

export default function Configuracoes() {
  const { usuario, atualizarUsuario } = useAuth()
  const ehSuperusuario = Boolean(usuario?.is_superuser)
  const { theme, toggleTheme } = useTheme()
  const [aba, setAba] = useState('aparencia')
  const [mensagem, setMensagem] = useState(null)

  const [perfil, setPerfil] = useState({ nome: usuario?.nome ?? '', email: usuario?.email ?? '' })
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [senhas, setSenhas] = useState({ atual: '', nova: '', confirmacao: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const [portalAtivo, setPortalAtivo] = useState(true)
  const [pix, setPix] = useState({ chave: '', nome_recebedor: '', cidade: '' })
  const [salvandoPrivacidade, setSalvandoPrivacidade] = useState(false)
  const [exportando, setExportando] = useState(false)

  useEffect(() => {
    api.get('/configuracoes/pix/').then((r) => setPix(r.data)).catch(() => {})
    api.get('/configuracoes/instituicao/').then((r) => setPortalAtivo(r.data.portal_ativo)).catch(() => {})
  }, [])

  const avisar = useCallback((tipo, texto) => {
    setMensagem({ tipo, texto })
    setTimeout(() => setMensagem(null), 4000)
  }, [])

  async function salvarPerfil(e) {
    e.preventDefault()
    setSalvandoPerfil(true)
    try {
      const { data } = await api.patch('/auth/me/', perfil)
      atualizarUsuario(data)
      avisar('ok', 'Perfil atualizado com sucesso.')
    } catch (err) {
      avisar('erro', mensagemErro(err, 'Erro ao atualizar o perfil.'))
    } finally {
      setSalvandoPerfil(false)
    }
  }

  async function salvarSenha(e) {
    e.preventDefault()
    if (senhas.nova !== senhas.confirmacao) {
      avisar('erro', 'A confirmação não confere com a nova senha.')
      return
    }
    setSalvandoSenha(true)
    try {
      await api.post('/auth/alterar-senha/', { senha_atual: senhas.atual, nova_senha: senhas.nova })
      setSenhas({ atual: '', nova: '', confirmacao: '' })
      avisar('ok', 'Senha alterada com sucesso.')
    } catch (err) {
      avisar('erro', mensagemErro(err, 'Não foi possível alterar a senha.'))
    } finally {
      setSalvandoSenha(false)
    }
  }

  async function salvarPrivacidade() {
    setSalvandoPrivacidade(true)
    try {
      const [inst, chave] = await Promise.all([
        api.patch('/configuracoes/instituicao/', { portal_ativo: portalAtivo }),
        api.put('/configuracoes/pix/', pix),
      ])
      setPortalAtivo(inst.data.portal_ativo)
      setPix(chave.data)
      avisar('ok', 'Configurações salvas.')
    } catch (err) {
      avisar('erro', mensagemErro(err, 'Erro ao salvar. Verifique os dados.'))
    } finally {
      setSalvandoPrivacidade(false)
    }
  }

  async function exportarDados() {
    setExportando(true)
    try {
      const [doacoes, membros, campanhas] = await Promise.all([
        buscarTodas('/doacoes/'), buscarTodas('/apoiadores/'), buscarTodas('/campanhas/'),
      ])
      const exportadoEm = new Date().toISOString()
      const blob = new Blob([JSON.stringify({ exportado_em: exportadoEm, doacoes, membros, campanhas }, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `uniong_export_${exportadoEm.slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      avisar('erro', 'Erro ao exportar dados.')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Configurações</h1>
        <p className="text-xs text-[var(--text-muted)]">Aparência, perfil e dados da organização</p>
      </div>

      {mensagem && (
        <div
          role={mensagem.tipo === 'ok' ? 'status' : 'alert'}
          className={`text-sm px-4 py-2.5 rounded-lg font-medium ${
            mensagem.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensagem.texto}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-6">
        <nav className="sm:w-48 flex-shrink-0 flex sm:flex-col gap-1" aria-label="Seções das configurações">
          {ABAS.filter((a) => !a.soSuperusuario || ehSuperusuario).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              aria-current={aba === id ? 'page' : undefined}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={aba === id ? { backgroundColor: 'rgba(15,76,92,0.1)', color: '#0f4c5c' } : { color: 'var(--text-secondary)' }}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        <div className="flex-1 space-y-4">
          {aba === 'aparencia' && (
            <Card title="Aparência">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Tema</p>
                  <p className="text-xs text-[var(--text-muted)]">Salvo neste navegador</p>
                </div>
                <div className="flex gap-2" role="group" aria-label="Tema">
                  {[{ id: 'light', label: 'Claro', Icon: Sun }, { id: 'dark', label: 'Escuro', Icon: Moon }].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      onClick={() => id !== theme && toggleTheme()}
                      aria-pressed={theme === id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                      style={theme === id
                        ? { borderColor: '#0f4c5c', color: '#0f4c5c', backgroundColor: 'rgba(15,76,92,0.08)' }
                        : { borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card-alt)' }}
                    >
                      <Icon size={12} aria-hidden="true" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {aba === 'perfil' && (
            <>
              <form onSubmit={salvarPerfil}>
                <Card title="Informações do perfil">
                  <CampoTexto id="perfil-nome" rotulo="Nome" value={perfil.nome} required
                    onChange={(e) => setPerfil((p) => ({ ...p, nome: e.target.value }))} />
                  <CampoTexto id="perfil-email" rotulo="E-mail (usado no login com Google)" type="email" value={perfil.email} required
                    onChange={(e) => setPerfil((p) => ({ ...p, email: e.target.value }))} />
                  <CampoTexto id="perfil-usuario" rotulo="Usuário (somente leitura)" value={usuario?.username ?? ''} readOnly disabled />
                  <div className="flex justify-end">
                    <button type="submit" disabled={salvandoPerfil} className={botaoPrimario} style={{ backgroundColor: '#0f4c5c' }}>
                      <Save size={14} aria-hidden="true" /> {salvandoPerfil ? 'Salvando...' : 'Salvar perfil'}
                    </button>
                  </div>
                </Card>
              </form>

              <form onSubmit={salvarSenha}>
                <Card title="Alterar senha">
                  <div>
                    <label htmlFor="senha-atual" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Senha atual</label>
                    <div className="relative">
                      <input id="senha-atual" className={inputCls + ' pr-9'} type={mostrarSenha ? 'text' : 'password'} required
                        value={senhas.atual} autoComplete="current-password"
                        onChange={(e) => setSenhas((s) => ({ ...s, atual: e.target.value }))} />
                      <button type="button" onClick={() => setMostrarSenha((v) => !v)}
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        {mostrarSenha ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CampoTexto id="senha-nova" rotulo="Nova senha" type="password" required autoComplete="new-password"
                      value={senhas.nova} onChange={(e) => setSenhas((s) => ({ ...s, nova: e.target.value }))} />
                    <CampoTexto id="senha-confirmacao" rotulo="Confirmar nova senha" type="password" required autoComplete="new-password"
                      value={senhas.confirmacao} onChange={(e) => setSenhas((s) => ({ ...s, confirmacao: e.target.value }))} />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">Mínimo de 8 caracteres, sem ser só números nem uma senha comum.</p>
                  <div className="flex justify-end">
                    <button type="submit" disabled={salvandoSenha} className={botaoPrimario} style={{ backgroundColor: '#0f4c5c' }}>
                      <Save size={14} aria-hidden="true" /> {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
                    </button>
                  </div>
                </Card>
              </form>
            </>
          )}

          {aba === 'instituicao' && ehSuperusuario && <FormInstituicao avisar={avisar} />}

          {aba === 'privacidade' && (
            <>
              {!ehSuperusuario && (
                <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-card-alt)] border border-[var(--border)] rounded-lg px-3 py-2">
                  Somente superusuários podem alterar estas configurações.
                </p>
              )}
              <Card title="Transparência pública">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Portal de transparência ativo</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Desligado, o endereço /transparencia mostra “Portal indisponível” e não aceita doações.
                    </p>
                  </div>
                  <Toggle checked={portalAtivo} onChange={setPortalAtivo} disabled={!ehSuperusuario} rotulo="Portal de transparência ativo" />
                </div>
              </Card>

              <Card title="Chave PIX da instituição">
                <p className="text-xs text-[var(--text-muted)] -mt-2">
                  Usada para gerar os QR Codes de doação no portal de transparência.
                </p>
                <fieldset disabled={!ehSuperusuario} className="space-y-3">
                  <CampoTexto id="pix-chave" rotulo="Chave PIX" value={pix.chave} maxLength={77}
                    placeholder="CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória"
                    onChange={(e) => setPix((p) => ({ ...p, chave: e.target.value }))} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CampoTexto id="pix-nome" rotulo="Nome do recebedor" value={pix.nome_recebedor} maxLength={25} placeholder="Como no cadastro do banco"
                      onChange={(e) => setPix((p) => ({ ...p, nome_recebedor: e.target.value }))} />
                    <CampoTexto id="pix-cidade" rotulo="Cidade" value={pix.cidade} maxLength={15} placeholder="São Paulo"
                      onChange={(e) => setPix((p) => ({ ...p, cidade: e.target.value }))} />
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Nome e cidade iguais aos cadastrados no banco (até 25 e 15 caracteres). Toda alteração é registrada e notificada à equipe.
                  </p>
                </fieldset>
              </Card>

              {ehSuperusuario && (
                <div className="flex justify-end">
                  <button onClick={salvarPrivacidade} disabled={salvandoPrivacidade} className={botaoPrimario} style={{ backgroundColor: '#0f4c5c' }}>
                    <Save size={14} aria-hidden="true" /> {salvandoPrivacidade ? 'Salvando...' : 'Salvar configurações'}
                  </button>
                </div>
              )}

              <Card title="Exportação de dados">
                <p className="text-xs text-[var(--text-muted)]">
                  Exporta todos os registros de doações, membros e campanhas em formato JSON.
                </p>
                <button
                  onClick={exportarDados}
                  disabled={exportando}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50"
                  style={{ borderColor: '#0f4c5c', color: '#0f4c5c' }}
                >
                  <Download size={14} aria-hidden="true" /> {exportando ? 'Exportando...' : 'Exportar dados (JSON)'}
                </button>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
