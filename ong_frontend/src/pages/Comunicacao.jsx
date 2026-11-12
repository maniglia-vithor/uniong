import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Megaphone, Globe, Users, Mail } from 'lucide-react'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import Paginacao from '../components/Paginacao'
import { CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { mensagemErro } from '../utils/formatos'
import { getComunicados, criarComunicado, atualizarComunicado, excluirComunicado, enviarComunicadoEmail, getDestinatariosComunicado } from '../services/api'

const VAZIO = { titulo: '', conteudo: '', publico_alvo: 'publico', enviar_email: false }

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function PublicoIcon({ tipo }) {
  if (tipo === 'publico') return <Globe size={13} className="text-blue-500" />
  return <Users size={13} className="text-purple-500" />
}

export default function Comunicacao() {
  const lista = useListaPaginada(getComunicados)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [destinatarios, setDestinatarios] = useState(null)

  useEffect(() => {
    if (modal) getDestinatariosComunicado().then(({ data }) => setDestinatarios(data)).catch(() => {})
  }, [modal])

  const carregar = lista.recarregar

  function abrirNovo() { setEditando(null); setForm(VAZIO); setModal(true) }
  function abrirEdicao(item) {
    setEditando(item)
    setForm({ titulo: item.titulo, conteudo: item.conteudo, publico_alvo: item.publico_alvo, enviar_email: false })
    setModal(true)
  }
  function fechar() { setModal(false); setEditando(null) }
  function onChange(e) {
    const { name, type, checked, value } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const { enviar_email: enviarEmail, ...dados } = form
    try {
      const { data } = editando ? await atualizarComunicado(editando.id, dados) : await criarComunicado(dados)
      if (enviarEmail && data.publico_alvo === 'apoiadores') await enviarEmail_(data.id, false)
      fechar(); carregar()
    } catch (err) { alert(mensagemErro(err, 'Erro ao salvar comunicado.')) }
    finally { setSalvando(false) }
  }

  async function enviarEmail_(id, perguntar = true) {
    if (perguntar && !confirm('Enviar este comunicado por e-mail aos membros ativos? O envio não pode ser desfeito.')) return
    try {
      const { data } = await enviarComunicadoEmail(id)
      alert(`Comunicado enviado por e-mail para ${data.emails_enviados} membro(s).`)
      carregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível enviar o comunicado por e-mail.'))
    }
  }

  async function onExcluir(id, titulo) {
    if (!confirm(`Excluir o comunicado "${titulo}"?`)) return
    try { await excluirComunicado(id); carregar() } catch (err) { alert(mensagemErro(err, 'Não foi possível excluir o comunicado.')) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Comunicação</h1>
          <p className="text-xs text-[var(--text-muted)]">Gerencie comunicados e publicações da organização</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Novo Comunicado
        </button>
      </div>

      <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar comunicados" />

      {lista.erro && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{lista.erro}</div>}

      {lista.carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
        </div>
      ) : lista.itens.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col items-center justify-center py-16 gap-3">
          <Megaphone size={32} className="text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)] text-sm">Nenhum comunicado publicado ainda.</p>
          <button onClick={abrirNovo} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#0f4c5c' }}>
            Criar primeiro comunicado
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.itens.map((c) => (
            <div key={c.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PublicoIcon tipo={c.publico_alvo} />
                    <span className="text-xs text-[var(--text-muted)]">
                      {c.publico_alvo_display}{c.publico_alvo === 'apoiadores' ? ' — não aparece no portal' : ''}
                    </span>
                    {c.enviado_em && (
                      <span className="text-xs text-emerald-700 flex items-center gap-1">
                        <Mail size={12} aria-hidden="true" /> enviado a {c.emails_enviados} membro(s) em {formatDateTime(c.enviado_em)}
                      </span>
                    )}
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDateTime(c.data_publicacao)}</span>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2">{c.titulo}</h3>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">{c.conteudo}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {c.publico_alvo === 'apoiadores' && !c.enviado_em && (
                    <button onClick={() => enviarEmail_(c.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                      <Mail size={12} aria-hidden="true" /> Enviar por e-mail
                    </button>
                  )}
                  <button onClick={() => abrirEdicao(c)} aria-label={`Editar ${c.titulo}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-700 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onExcluir(c.id, c.titulo)} aria-label={`Excluir ${c.titulo}`} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
        </div>
      )}

      {modal && (
        <Modal titulo={editando ? 'Editar Comunicado' : 'Novo Comunicado'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Título">
              <Input name="titulo" value={form.titulo} onChange={onChange} placeholder="Título do comunicado" required />
            </Campo>
            <Campo label="Conteúdo">
              <textarea
                name="conteudo"
                value={form.conteudo}
                onChange={onChange}
                rows={6}
                required
                placeholder="Escreva o conteúdo do comunicado..."
                className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none"
              />
            </Campo>
            <Campo label="Público-alvo">
              <Select name="publico_alvo" value={form.publico_alvo} onChange={onChange}>
                <option value="publico">Público (visível no portal)</option>
                <option value="apoiadores">Somente Membros</option>
              </Select>
            </Campo>
            {form.publico_alvo === 'apoiadores' && (
              <div className="text-xs text-[var(--text-muted)] bg-[var(--bg-card-alt)] border border-[var(--border)] rounded-lg px-3 py-2 -mt-2 space-y-2">
                <p>Comunicados “Somente Membros” não aparecem no portal de transparência.</p>
                {!editando?.enviado_em && (
                  <label className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <input type="checkbox" name="enviar_email" checked={form.enviar_email} onChange={onChange} className="mt-0.5" />
                    <span>
                      Enviar por e-mail aos membros ativos
                      {destinatarios && <> ({destinatarios.quantidade} destinatário{destinatarios.quantidade !== 1 ? 's' : ''})</>}
                      {destinatarios && destinatarios.quantidade > destinatarios.limite && (
                        <span className="block text-amber-700">Acima do limite de {destinatarios.limite} do envio pela tela: o envio deve ser feito pelo comando enviar_comunicado.</span>
                      )}
                    </span>
                  </label>
                )}
                <p>Cada e-mail traz um link para o membro deixar de receber comunicados.</p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={fechar} />
              <BotaoSubmit carregando={salvando} label="Publicar" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
