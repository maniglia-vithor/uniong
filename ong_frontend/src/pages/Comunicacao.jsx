import { useEffect, useState } from 'react'
import { useRole } from '../context/RoleContext'
import { Pencil, Trash2, Plus, Megaphone, Globe, Users } from 'lucide-react'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import { getComunicados, criarComunicado, atualizarComunicado, excluirComunicado } from '../services/api'

const VAZIO = { titulo: '', conteudo: '', publico_alvo: 'publico' }

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
  const { isAdmin } = useRole()
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = () => {
    setCarregando(true)
    getComunicados()
      .then((r) => setLista(r.data.results ?? r.data))
      .catch(() => setErro('Erro ao carregar comunicados.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm(VAZIO); setModal(true) }
  function abrirEdicao(item) {
    setEditando(item)
    setForm({ titulo: item.titulo, conteudo: item.conteudo, publico_alvo: item.publico_alvo })
    setModal(true)
  }
  function fechar() { setModal(false); setEditando(null) }
  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editando) await atualizarComunicado(editando.id, form)
      else await criarComunicado(form)
      fechar(); carregar()
    } catch { alert('Erro ao salvar comunicado.') }
    finally { setSalvando(false) }
  }

  async function onExcluir(id, titulo) {
    if (!confirm(`Excluir o comunicado "${titulo}"?`)) return
    await excluirComunicado(id); carregar()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Comunicação</h1>
          <p className="text-xs text-[var(--text-muted)]">Gerencie comunicados e publicações da organização</p>
        </div>
        {isAdmin && <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Novo Comunicado
        </button>}
      </div>

      {erro && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{erro}</div>}

      {carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
        </div>
      ) : lista.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm flex flex-col items-center justify-center py-16 gap-3">
          <Megaphone size={32} className="text-[var(--text-muted)]" />
          <p className="text-[var(--text-muted)] text-sm">Nenhum comunicado publicado ainda.</p>
          {isAdmin && <button onClick={abrirNovo} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white" style={{ backgroundColor: '#0f4c5c' }}>
            Criar primeiro comunicado
          </button>}
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((c) => (
            <div key={c.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <PublicoIcon tipo={c.publico_alvo} />
                    <span className="text-xs text-[var(--text-muted)]">{c.publico_alvo_display}</span>
                    <span className="text-[var(--text-muted)]">·</span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDateTime(c.data_publicacao)}</span>
                  </div>
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2">{c.titulo}</h3>
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">{c.conteudo}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {isAdmin && <button onClick={() => abrirEdicao(c)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-700 transition-colors">
                    <Pencil size={14} />
                  </button>}
                  {isAdmin && <button onClick={() => onExcluir(c.id, c.titulo)} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>}
                </div>
              </div>
            </div>
          ))}
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
