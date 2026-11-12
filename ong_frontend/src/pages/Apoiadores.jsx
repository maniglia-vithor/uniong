import { useEffect, useState, useMemo } from 'react'
import { Pencil, Trash2, UserPlus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import { formatCelular, mensagemErro } from '../utils/formatos'
import { getApoiadores, criarApoiador, atualizarApoiador, excluirApoiador } from '../services/api'

const VAZIO = { nome: '', email: '', celular: '', status: 'ativo' }

function SortIcon({ dir }) {
  if (dir === 'asc') return <ChevronUp size={12} className="inline-block ml-1" />
  if (dir === 'desc') return <ChevronDown size={12} className="inline-block ml-1" />
  return <ChevronsUpDown size={12} className="inline-block ml-1 opacity-30" />
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function Apoiadores() {
  const { openDrawer } = useOutletContext() ?? {}
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else { setSortCol(col); setSortDir('asc') }
  }

  const TIPO_COL = {
    nome: 'texto', email: 'texto', celular: 'texto',
    data_cadastro: 'data', total_doado: 'numero', status: 'texto',
  }

  const listaOrdenada = useMemo(() => {
    if (!sortCol) return lista
    return [...lista].sort((a, b) => {
      let va = a[sortCol]; let vb = b[sortCol]
      if (va == null) va = TIPO_COL[sortCol] === 'numero' ? -Infinity : ''
      if (vb == null) vb = TIPO_COL[sortCol] === 'numero' ? -Infinity : ''
      const cmp = TIPO_COL[sortCol] === 'numero'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR')
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [lista, sortCol, sortDir])

  const colHeader = (key, label, align = 'left') => (
    <th
      onClick={() => handleSort(key)}
      className={`text-${align} text-xs font-medium text-[var(--text-muted)] px-5 py-3 cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors whitespace-nowrap`}
    >
      {label}<SortIcon dir={sortCol === key ? sortDir : null} />
    </th>
  )

  const carregar = () => {
    setCarregando(true)
    getApoiadores()
      .then((r) => setLista(r.data.results ?? r.data))
      .catch(() => setErro('Erro ao carregar membros.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setModal(true)
  }

  function abrirEdicao(item) {
    setEditando(item)
    setForm({ nome: item.nome, email: item.email, celular: item.celular || '', status: item.status })
    setModal(true)
  }

  function fechar() {
    setModal(false)
    setEditando(null)
  }

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editando) {
        await atualizarApoiador(editando.id, form)
      } else {
        await criarApoiador(form)
      }
      fechar()
      carregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id, nome) {
    if (!confirm(`Excluir o membro "${nome}"?`)) return
    try {
      await excluirApoiador(id)
      carregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível excluir o membro.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Membros</h1>
          <p className="text-xs text-[var(--text-muted)]">Gerencie os membros da organização</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <UserPlus size={15} />
          Novo Membro
        </button>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {erro && <p className="text-red-500 text-sm p-4">{erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {colHeader('nome', 'Membro')}
                {colHeader('email', 'E-mail')}
                {colHeader('celular', 'Celular')}
                {colHeader('data_cadastro', 'Cadastro')}
                {colHeader('total_doado', 'Total Doado', 'right')}
                {colHeader('status', 'Status')}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {carregando ? (
                <tr><td colSpan={7} className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <TabelaVazia />
              ) : (
                listaOrdenada.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'apoiador', id: a.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(a.nome)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{a.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{a.email}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{a.celular ? formatCelular(a.celular) : <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(a.data_cadastro)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">{formatBRL(a.total_doado)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={a.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(a)} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onExcluir(a.id, a.nome)} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal titulo={editando ? 'Editar Membro' : 'Novo Membro'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Nome completo">
              <Input name="nome" value={form.nome} onChange={onChange} placeholder="Ex: Maria da Silva" required />
            </Campo>
            <Campo label="E-mail">
              <Input name="email" type="email" value={form.email} onChange={onChange} placeholder="maria@email.com" required />
            </Campo>
            <Campo label="Celular (opcional)">
              <Input name="celular" value={form.celular} onChange={onChange} placeholder="(11) 99999-9999" />
            </Campo>
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Campo>
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={fechar} />
              <BotaoSubmit carregando={salvando} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
