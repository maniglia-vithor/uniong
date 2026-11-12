import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Pencil, Save, XCircle } from 'lucide-react'
import api from '../services/api'
import BadgeStatus from './BadgeStatus'
import BarraProgresso from './BarraProgresso'
import { Campo, Input, Select } from './CampoForm'
import CampoData from './CampoData'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}
function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function iniciais(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

// ── Detalhe Doação ──────────────────────────────────────────
function DetalheDoacao({ record, onEdit }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#0f4c5c' }}>
          {iniciais(record.apoiador_nome)}
        </div>
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-base">{record.apoiador_nome}</p>
          <p className="text-xs text-[var(--text-muted)]">Doador</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Valor" value={formatBRL(record.valor)} destaque />
        <InfoBox label="Data" value={formatData(record.data)} />
        <InfoBox label="Status" value={<BadgeStatus status={record.status} />} />
        <InfoBox label="Campanha" value={record.campanha_titulo || '—'} />
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Doação
      </button>
    </div>
  )
}

function EditDoacao({ record, apoiadores, campanhas, onSaved, onCancel }) {
  const [form, setForm] = useState({
    apoiador: record.apoiador,
    campanha: record.campanha || '',
    valor: record.valor,
    data: record.data,
    status: record.status,
  })
  const [salvando, setSalvando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put(`/doacoes/${record.id}/`, { ...form, campanha: form.campanha || null })
      onSaved()
    } catch { alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Membro">
        <Select name="apoiador" value={form.apoiador} onChange={e => setForm(f => ({ ...f, apoiador: e.target.value }))} required>
          <option value="">Selecione...</option>
          {apoiadores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </Select>
      </Campo>
      <Campo label="Campanha (opcional)">
        <Select name="campanha" value={form.campanha} onChange={e => setForm(f => ({ ...f, campanha: e.target.value }))}>
          <option value="">Sem campanha</option>
          {campanhas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Valor (R$)">
          <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor}
            onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} required />
        </Campo>
        <Campo label="Data">
          <CampoData name="data" value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
        </Campo>
      </div>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="confirmada">Confirmada</option>
          <option value="pendente">Pendente</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe Campanha ────────────────────────────────────────
function DetalheCampanha({ record, onEdit }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-base">{record.titulo}</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{record.descricao || 'Sem descrição.'}</p>
      </div>
      <div>
        <div className="flex justify-between mb-1.5 text-xs text-[var(--text-secondary)]">
          <span>{formatBRL(record.valor_arrecadado)} arrecadados</span>
          <span className="font-semibold" style={{ color: '#f97316' }}>{record.percentual_progresso}%</span>
        </div>
        <BarraProgresso percentual={record.percentual_progresso} cor="#f97316" />
        <p className="text-xs text-[var(--text-muted)] mt-1">Meta: {formatBRL(record.meta_valor)}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Status" value={<BadgeStatus status={record.status} />} />
        <InfoBox label="Início" value={formatData(record.data_inicio)} />
        <InfoBox label="Encerramento" value={formatData(record.data_fim)} />
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Campanha
      </button>
    </div>
  )
}

function EditCampanha({ record, onSaved, onCancel }) {
  const [form, setForm] = useState({
    titulo: record.titulo,
    meta_valor: record.meta_valor,
    status: record.status,
    data_inicio: record.data_inicio,
    data_fim: record.data_fim || '',
    descricao: record.descricao || '',
  })
  const [salvando, setSalvando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put(`/campanhas/${record.id}/`, { ...form, data_fim: form.data_fim || null })
      onSaved()
    } catch { alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Título">
        <Input name="titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
      </Campo>
      <Campo label="Meta (R$)">
        <Input name="meta_valor" type="number" min="1" step="0.01" value={form.meta_valor}
          onChange={e => setForm(f => ({ ...f, meta_valor: e.target.value }))} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Data de início">
          <CampoData name="data_inicio" value={form.data_inicio}
            onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} required />
        </Campo>
        <Campo label="Encerramento">
          <CampoData name="data_fim" value={form.data_fim}
            onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
        </Campo>
      </div>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="encerrada">Encerrada</option>
        </Select>
      </Campo>
      <Campo label="Descrição">
        <textarea name="descricao" value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          rows={3} className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none" />
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe Apoiador ────────────────────────────────────────
function DetalheApoiador({ record, onEdit }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#3b82f6' }}>
          {iniciais(record.nome)}
        </div>
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-base">{record.nome}</p>
          <p className="text-xs text-[var(--text-muted)]">{record.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Status" value={<BadgeStatus status={record.status} />} />
        <InfoBox label="Cadastro" value={formatData(record.data_cadastro)} />
        <InfoBox label="Total doado" value={formatBRL(record.total_doado)} destaque />
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Membro
      </button>
    </div>
  )
}

function EditApoiador({ record, onSaved, onCancel }) {
  const [form, setForm] = useState({ nome: record.nome, email: record.email, status: record.status })
  const [salvando, setSalvando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put(`/apoiadores/${record.id}/`, form)
      onSaved()
    } catch { alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Nome completo">
        <Input name="nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
      </Campo>
      <Campo label="E-mail">
        <Input name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
      </Campo>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Caixa de info ────────────────────────────────────────────
function InfoBox({ label, value, destaque }) {
  return (
    <div className="bg-[var(--bg-card-alt)] rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
      <div className={`text-sm font-medium ${destaque ? 'text-teal-700' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  )
}

// ── Drawer principal ────────────────────────────────────────
export default function RecordDetailDrawer({ target, onClose, onRefresh }) {
  const [record, setRecord] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [apoiadores, setApoiadores] = useState([])
  const [campanhas, setCampanhas] = useState([])

  const endpointMap = { doacao: 'doacoes', campanha: 'campanhas', apoiador: 'apoiadores' }
  const tituloMap = { doacao: 'Doação', campanha: 'Campanha', apoiador: 'Membro' }

  useEffect(() => {
    if (!target) return
    setCarregando(true)
    setEditando(false)
    const ep = endpointMap[target.type]
    const reqs = [api.get(`/${ep}/${target.id}/`)]
    if (target.type === 'doacao') {
      reqs.push(api.get('/apoiadores/opcoes/'))
      reqs.push(api.get('/campanhas/opcoes/'))
    }
    Promise.all(reqs)
      .then(([r, a, c]) => {
        setRecord(r.data)
        if (a) {
          const membros = a.data
          if (r.data.apoiador && !membros.some(m => m.id === r.data.apoiador)) {
            membros.unshift({ id: r.data.apoiador, nome: r.data.apoiador_nome })
          }
          setApoiadores(membros)
        }
        if (c) {
          const camps = c.data
          if (r.data.campanha && !camps.some(x => x.id === r.data.campanha)) {
            camps.unshift({ id: r.data.campanha, titulo: `${r.data.campanha_titulo} (encerrada)` })
          }
          setCampanhas(camps)
        }
      })
      .catch(() => setRecord(null))
      .finally(() => setCarregando(false))
  }, [target])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!target) return null

  function handleSaved() {
    setEditando(false)
    onRefresh?.()
    const ep = endpointMap[target.type]
    api.get(`/${ep}/${target.id}/`).then(r => setRecord(r.data))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: target.type === 'doacao' ? '#22c55e' : target.type === 'campanha' ? '#f97316' : '#3b82f6' }}
            >
              {tituloMap[target.type]}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {editando ? `Editar ${tituloMap[target.type]}` : 'Detalhes'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {carregando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
            </div>
          ) : !record ? (
            <p className="text-slate-400 text-sm text-center py-12">Registro não encontrado.</p>
          ) : editando ? (
            <>
              {target.type === 'doacao' && (
                <EditDoacao record={record} apoiadores={apoiadores} campanhas={campanhas}
                  onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
              {target.type === 'campanha' && (
                <EditCampanha record={record} onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
              {target.type === 'apoiador' && (
                <EditApoiador record={record} onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
            </>
          ) : (
            <>
              {target.type === 'doacao' && <DetalheDoacao record={record} onEdit={() => setEditando(true)} />}
              {target.type === 'campanha' && <DetalheCampanha record={record} onEdit={() => setEditando(true)} />}
              {target.type === 'apoiador' && <DetalheApoiador record={record} onEdit={() => setEditando(true)} />}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
