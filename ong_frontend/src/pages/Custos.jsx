import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Pencil, Trash2, TrendingDown, AlertCircle, Tag, ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import {
  getDespesas, criarDespesa, atualizarDespesa, excluirDespesa,
  getDespesasResumo, getDespesasPorCategoria,
} from '../services/api'

const VAZIO = {
  descricao: '', valor: '', data_vencimento: '', data_pagamento: '',
  categoria: 'outros', status: 'pendente',
}

const CATEGORIAS = [
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'recursos_humanos', label: 'Recursos Humanos' },
  { value: 'projetos', label: 'Projetos' },
  { value: 'captacao', label: 'Captação de Recursos' },
  { value: 'outros', label: 'Outros' },
]

const CORES_CATEGORIA = {
  administrativo: '#0f4c5c',
  recursos_humanos: '#f97316',
  projetos: '#0891b2',
  captacao: '#7c3aed',
  outros: '#94a3b8',
}

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function KpiCusto({ titulo, valor, subtitulo, icone: Icone, cor }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{titulo}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{valor}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cor}18` }}>
          <Icone size={20} style={{ color: cor }} />
        </div>
      </div>
      {subtitulo && <p className="text-xs text-slate-400 mt-2">{subtitulo}</p>}
    </div>
  )
}

function SortIcon({ dir }) {
  if (dir === 'asc') return <ChevronUp size={12} className="inline-block ml-1" />
  if (dir === 'desc') return <ChevronDown size={12} className="inline-block ml-1" />
  return <ChevronsUpDown size={12} className="inline-block ml-1 opacity-30" />
}

export default function Custos() {
  const [lista, setLista] = useState([])
  const [resumo, setResumo] = useState(null)
  const [grafico, setGrafico] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const carregar = () => {
    setCarregando(true)
    setErro(null)
    Promise.all([getDespesas(), getDespesasResumo(), getDespesasPorCategoria()])
      .then(([d, r, g]) => {
        setLista(d.data.results ?? d.data)
        setResumo(r.data)
        setGrafico(g.data)
      })
      .catch(() => setErro('Erro ao carregar dados. Verifique se o servidor está rodando.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm(VAZIO); setModal(true) }

  function abrirEdicao(item) {
    setEditando(item)
    setForm({
      descricao: item.descricao,
      valor: item.valor,
      data_vencimento: item.data_vencimento,
      data_pagamento: item.data_pagamento || '',
      categoria: item.categoria,
      status: item.status,
    })
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null) }
  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const payload = { ...form, data_pagamento: form.data_pagamento || null }
    try {
      if (editando) await atualizarDespesa(editando.id, payload)
      else await criarDespesa(payload)
      fechar()
      carregar()
    } catch { alert('Erro ao salvar. Verifique os dados.') }
    finally { setSalvando(false) }
  }

  async function onExcluir(id) {
    if (!confirm('Excluir esta despesa?')) return
    await excluirDespesa(id)
    carregar()
  }

  function handleSort(col) {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else { setSortCol(col); setSortDir('asc') }
  }

  const TIPO_COL = {
    descricao: 'texto', categoria_display: 'texto',
    data_vencimento: 'data', valor: 'numero', status_efetivo: 'texto',
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
      className={`text-${align} text-xs font-medium text-slate-400 px-5 py-3 cursor-pointer select-none hover:text-slate-700 transition-colors whitespace-nowrap`}
    >
      {label}<SortIcon dir={sortCol === key ? sortDir : null} />
    </th>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Custos</h1>
          <p className="text-xs text-slate-400">{lista.length} registro{lista.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Novo Custo
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{erro}</div>
      )}

      {/* KPI Cards */}
      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCusto
            titulo="Gasto do Mês"
            valor={formatBRL(resumo.gasto_mes)}
            subtitulo="Despesas com vencimento neste mês"
            icone={TrendingDown}
            cor="#dc2626"
          />
          <KpiCusto
            titulo="Total Pendente"
            valor={formatBRL(resumo.total_pendente)}
            subtitulo="Inclui pendentes e atrasadas"
            icone={AlertCircle}
            cor="#f97316"
          />
          <KpiCusto
            titulo="Maior Categoria"
            valor={resumo.maior_categoria_display || '—'}
            subtitulo="Categoria com mais gastos no mês"
            icone={Tag}
            cor="#7c3aed"
          />
        </div>
      )}

      {/* Gráfico + Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Distribuição por Categoria (mês atual)</h2>
          {grafico.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-300 text-sm">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={grafico}
                  dataKey="total"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {grafico.map((entry) => (
                    <Cell key={entry.categoria} fill={CORES_CATEGORIA[entry.categoria] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid #e2e8f0' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {colHeader('descricao', 'Descrição')}
                  {colHeader('categoria_display', 'Categoria')}
                  {colHeader('data_vencimento', 'Vencimento')}
                  {colHeader('valor', 'Valor', 'right')}
                  {colHeader('status_efetivo', 'Status')}
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {carregando ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Carregando...</td></tr>
                ) : listaOrdenada.length === 0 ? (
                  <TabelaVazia />
                ) : (
                  listaOrdenada.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700 max-w-[200px] truncate">{d.descricao}</td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${CORES_CATEGORIA[d.categoria] ?? '#94a3b8'}18`,
                            color: CORES_CATEGORIA[d.categoria] ?? '#64748b',
                          }}
                        >
                          {d.categoria_display}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatData(d.data_vencimento)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatBRL(d.valor)}</td>
                      <td className="px-5 py-3"><BadgeStatus status={d.status_efetivo} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => abrirEdicao(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-700 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onExcluir(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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
      </div>

      {/* Modal CRUD */}
      {modal && (
        <Modal titulo={editando ? 'Editar Despesa' : 'Novo Custo'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Descrição">
              <Input name="descricao" value={form.descricao} onChange={onChange} placeholder="Ex: Aluguel do escritório" required />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)">
                <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={onChange} placeholder="0,00" required />
              </Campo>
              <Campo label="Vencimento">
                <Input name="data_vencimento" type="date" value={form.data_vencimento} onChange={onChange} required />
              </Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Categoria">
                <Select name="categoria" value={form.categoria} onChange={onChange}>
                  {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Campo>
              <Campo label="Status">
                <Select name="status" value={form.status} onChange={onChange}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                  <option value="atrasado">Atrasado</option>
                </Select>
              </Campo>
            </div>
            <Campo label="Data de Pagamento (opcional)">
              <Input name="data_pagamento" type="date" value={form.data_pagamento} onChange={onChange} />
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
