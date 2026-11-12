import { useCallback, useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, AlertCircle, Tag, CalendarClock, Paperclip, X, RefreshCw, Repeat } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import Paginacao from '../components/Paginacao'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import {
  getDespesas, criarDespesa, atualizarDespesa, excluirDespesa,
  removerAnexoDespesa, baixarAnexoDespesa, getDespesasResumo, getDespesasPorCategoria,
} from '../services/api'

const VAZIO = {
  descricao: '', valor: '', data_vencimento: '', data_pagamento: '',
  categoria: 'outros', status: 'pendente', is_fixed: false, recurrence_period: 'mensal',
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
    <div className="bg-[var(--bg-card)] rounded-xl p-5 shadow-sm border border-[var(--border)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{titulo}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{valor}</p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cor}18` }}>
          <Icone size={20} style={{ color: cor }} />
        </div>
      </div>
      {subtitulo && <p className="text-xs text-[var(--text-muted)] mt-2">{subtitulo}</p>}
    </div>
  )
}

export default function Custos() {
  const lista = useListaPaginada(getDespesas)
  const [resumo, setResumo] = useState(null)
  const [grafico, setGrafico] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [novosAnexos, setNovosAnexos] = useState([])
  const [salvando, setSalvando] = useState(false)

  const fileInputRef = useRef(null)

  const carregarResumo = useCallback(() => {
    Promise.all([getDespesasResumo(), getDespesasPorCategoria()])
      .then(([r, g]) => {
        setResumo(r.data)
        setGrafico(g.data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { carregarResumo() }, [carregarResumo])

  function carregar() {
    lista.recarregar()
    carregarResumo()
  }

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setNovosAnexos([])
    setModal(true)
  }

  function abrirEdicao(item) {
    setEditando(item)
    setForm({
      descricao: item.descricao,
      valor: item.valor,
      data_vencimento: item.data_vencimento,
      data_pagamento: item.data_pagamento || '',
      categoria: item.categoria,
      status: item.status,
      is_fixed: item.is_fixed ?? false,
      recurrence_period: item.recurrence_period || 'mensal',
    })
    setNovosAnexos([])
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null); setNovosAnexos([]) }

  function onChange(e) {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function onAddFiles(e) {
    const files = Array.from(e.target.files)
    setNovosAnexos((prev) => [...prev, ...files])
    e.target.value = ''
  }

  function removerNovoAnexo(idx) {
    setNovosAnexos((prev) => prev.filter((_, i) => i !== idx))
  }

  async function removerAnexoExistente(anexoId) {
    if (!editando) return
    await removerAnexoDespesa(editando.id, anexoId)
    setEditando((prev) => ({ ...prev, anexos: prev.anexos.filter((a) => a.id !== anexoId) }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const fd = new FormData()
    fd.append('descricao', form.descricao)
    fd.append('valor', form.valor)
    fd.append('data_vencimento', form.data_vencimento)
    if (form.data_pagamento) fd.append('data_pagamento', form.data_pagamento)
    fd.append('categoria', form.categoria)
    fd.append('status', form.status)
    fd.append('is_fixed', form.is_fixed ? 'true' : 'false')
    if (form.is_fixed) fd.append('recurrence_period', form.recurrence_period)
    novosAnexos.forEach((f) => fd.append('anexos', f))
    try {
      if (editando) await atualizarDespesa(editando.id, fd)
      else await criarDespesa(fd)
      fechar()
      carregar()
    } catch (err) {
      const erros = err.response?.data?.anexos
      alert(Array.isArray(erros) ? erros.join('\n') : 'Erro ao salvar. Verifique os dados.')
    }
    finally { setSalvando(false) }
  }

  async function onBaixarAnexo(anexo) {
    try {
      const { data } = await baixarAnexoDespesa(editando.id, anexo.id)
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = anexo.nome_original || 'anexo'
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Não foi possível baixar o anexo.')
    }
  }

  async function onExcluir(id) {
    if (!confirm('Excluir esta despesa?')) return
    await excluirDespesa(id)
    carregar()
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Custos</h1>
          <p className="text-xs text-[var(--text-muted)]">{lista.total} registro{lista.total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Novo Custo
        </button>
      </div>

      {lista.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{lista.erro}</div>
      )}

      {/* KPI Cards */}
      {resumo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCusto
            titulo="Gasto do Mês"
            valor={formatBRL(resumo.gasto_mes)}
            subtitulo="Despesas pagas neste mês (data de pagamento)"
            icone={TrendingDown}
            cor="#dc2626"
          />
          <KpiCusto
            titulo="A Pagar no Mês"
            valor={formatBRL(resumo.a_pagar_mes)}
            subtitulo="Pendentes com vencimento neste mês"
            icone={CalendarClock}
            cor="#0891b2"
          />
          <KpiCusto
            titulo="Total Pendente"
            valor={formatBRL(resumo.total_pendente)}
            subtitulo={`Todas as pendentes; ${formatBRL(resumo.total_atrasado)} já vencidas`}
            icone={AlertCircle}
            cor="#f97316"
          />
          <KpiCusto
            titulo="Maior Categoria"
            valor={resumo.maior_categoria_display || '—'}
            subtitulo="Categoria com mais gastos pagos no mês"
            icone={Tag}
            cor="#7c3aed"
          />
        </div>
      )}

      {/* Gráfico + Tabela */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Gastos pagos por categoria (mês atual)</h2>
          {grafico.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">Sem dados</div>
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
        <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
          <div className="p-3 border-b border-[var(--border)]">
            <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por descrição" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <CabecalhoOrdenavel lista={lista} campo="descricao" rotulo="Descrição" />
                  <CabecalhoOrdenavel lista={lista} campo="categoria" rotulo="Categoria" />
                  <CabecalhoOrdenavel lista={lista} campo="data_vencimento" rotulo="Vencimento" />
                  <CabecalhoOrdenavel lista={lista} campo="valor" rotulo="Valor" alinhamento="right" />
                  <CabecalhoOrdenavel lista={lista} campo="status" rotulo="Status" />
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {lista.carregando ? (
                  <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</td></tr>
                ) : lista.itens.length === 0 ? (
                  <TabelaVazia />
                ) : (
                  lista.itens.map((d) => (
                    <tr key={d.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)] max-w-[200px] truncate">{d.descricao}</td>
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
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(d.data_vencimento)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">{formatBRL(d.valor)}</td>
                      <td className="px-5 py-3"><BadgeStatus status={d.status_efetivo} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => abrirEdicao(d)} aria-label={`Editar ${d.descricao}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-700 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => onExcluir(d.id)} aria-label={`Excluir ${d.descricao}`} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
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
          <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
        </div>
      </div>

      {/* Modal CRUD */}
      {modal && (
        <Modal titulo={editando ? 'Editar Despesa' : 'Registrar despesa'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Descrição */}
            <Campo label="Descrição">
              <Input name="descricao" value={form.descricao} onChange={onChange} placeholder="Ex: Aluguel do escritório" required />
            </Campo>

            {/* Valor + Vencimento */}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)">
                <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={onChange} placeholder="0,00" required />
              </Campo>
              <Campo label="Vencimento">
                <CampoData name="data_vencimento" value={form.data_vencimento} onChange={onChange} required />
              </Campo>
            </div>

            {/* Categoria + Status */}
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
                </Select>
              </Campo>
            </div>

            {/* Data de pagamento */}
            <Campo label="Data de Pagamento (opcional)">
              <CampoData name="data_pagamento" value={form.data_pagamento} onChange={onChange} />
            </Campo>

            {/* Toggle Despesa Fixa */}
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_fixed: !f.is_fixed }))}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
                  <Repeat size={15} className="text-slate-400" />
                  Despesa fixa
                </div>
                {/* Toggle visual */}
                <div
                  className="relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
                  style={{ backgroundColor: form.is_fixed ? '#0f4c5c' : '#cbd5e1' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
                    style={{ transform: form.is_fixed ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </div>
              </button>

              {/* Seção de recorrência — expande quando is_fixed = true */}
              {form.is_fixed && (
                <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-card)]">
                  <Campo label="Frequência de repetição">
                    <Select name="recurrence_period" value={form.recurrence_period} onChange={onChange}>
                      <option value="semanal">Semanal</option>
                      <option value="mensal">Mensal</option>
                      <option value="anual">Anual</option>
                    </Select>
                  </Campo>
                  <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                    <RefreshCw size={11} />
                    A próxima despesa será gerada automaticamente ao marcar esta como paga.
                  </p>
                </div>
              )}
            </div>

            {/* Anexos — estilo Jira */}
            <div>
              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Anexos</p>

              {/* Anexos já salvos (modo edição) */}
              {editando?.anexos?.length > 0 && (
                <div className="space-y-1 mb-2">
                  {editando.anexos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[var(--bg-card-alt)] rounded-lg border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => onBaixarAnexo(a)}
                        className="text-xs text-teal-700 hover:underline truncate flex items-center gap-1.5"
                      >
                        <Paperclip size={11} className="flex-shrink-0" />
                        {a.nome_original}
                      </button>
                      <button
                        type="button"
                        onClick={() => removerAnexoExistente(a.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Novos arquivos selecionados */}
              {novosAnexos.length > 0 && (
                <div className="space-y-1 mb-2">
                  {novosAnexos.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-xs text-blue-700 truncate flex items-center gap-1.5">
                        <Paperclip size={11} className="flex-shrink-0" />
                        {f.name}
                      </span>
                      <button type="button" onClick={() => removerNovoAnexo(i)} className="text-blue-300 hover:text-red-500 transition-colors flex-shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Área de drop / botão */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] hover:border-[var(--border)] cursor-pointer transition-colors text-center"
              >
                <Paperclip size={18} className="text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-secondary)] font-medium">Adicionar anexo</span>
                <span className="text-[11px] text-[var(--text-muted)]">PDF, JPG, PNG ou WEBP, até 5 MB cada</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                onChange={onAddFiles}
              />
            </div>

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
