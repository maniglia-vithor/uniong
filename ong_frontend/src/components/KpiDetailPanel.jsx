import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import {
  getKpiDoacoes,
  getKpiDoacoesMes,
  getKpiApoiadoresAtivos,
  getKpiCampanhasAtivas,
  getDoacoesPorMes,
} from '../services/api'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const COLUNAS_DOACOES_MES = [
  { key: 'apoiador_nome', label: 'Doador', tipo: 'texto' },
  { key: 'valor', label: 'Valor', tipo: 'numero', render: formatBRL },
  { key: 'data', label: 'Data', tipo: 'data', render: formatData },
  { key: 'campanha', label: 'Origem', tipo: 'texto', render: (v) => v ?? 'Doação Avulsa' },
]

const CONFIG = {
  total_arrecadado: {
    titulo: 'Total Arrecadado — Todas as Doações Confirmadas',
    fetchFn: () => getKpiDoacoes(),
    colunas: [
      { key: 'apoiador_nome', label: 'Doador', tipo: 'texto' },
      { key: 'valor', label: 'Valor', tipo: 'numero', render: formatBRL },
      { key: 'data', label: 'Data', tipo: 'data', render: formatData },
    ],
  },
  doacoes_mes: {
    titulo: 'Doações do Mês',
    fetchFn: () => getKpiDoacoesMes(),
    colunas: COLUNAS_DOACOES_MES,
  },
  apoiadores_ativos: {
    titulo: 'Membros Ativos',
    fetchFn: () => getKpiApoiadoresAtivos(),
    colunas: [
      { key: 'nome', label: 'Nome', tipo: 'texto' },
      { key: 'email', label: 'E-mail', tipo: 'texto' },
      { key: 'data_cadastro', label: 'Cadastro', tipo: 'data', render: formatData },
    ],
  },
  campanhas_ativas: {
    titulo: 'Campanhas Ativas',
    fetchFn: () => getKpiCampanhasAtivas(),
    colunas: [
      { key: 'titulo', label: 'Campanha', tipo: 'texto' },
      { key: 'data_inicio', label: 'Início', tipo: 'data', render: formatData },
      { key: 'data_fim', label: 'Encerramento', tipo: 'data', render: formatData },
      { key: 'meta_valor', label: 'Meta', tipo: 'numero', render: formatBRL },
      { key: 'valor_arrecadado', label: 'Arrecadado', tipo: 'numero', render: formatBRL },
    ],
  },
}

function buildCfg(kpi) {
  if (!kpi) return null
  if (typeof kpi === 'string') return CONFIG[kpi] ?? null
  // { type: 'mes', mes: 'Nov/26', isoMes: '2026-11' }
  if (kpi.type === 'mes') {
    return {
      titulo: `Doações de ${kpi.mes}`,
      fetchFn: () => getDoacoesPorMes(kpi.isoMes),
      colunas: COLUNAS_DOACOES_MES,
    }
  }
  return null
}

function SortIcon({ dir }) {
  if (dir === 'asc') return <ChevronUp size={12} className="inline-block ml-1" />
  if (dir === 'desc') return <ChevronDown size={12} className="inline-block ml-1" />
  return <ChevronsUpDown size={12} className="inline-block ml-1 opacity-30" />
}

export default function KpiDetailPanel({ kpi, onClose }) {
  const [dados, setDados] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const cfg = buildCfg(kpi)
  const kpiKey = kpi ? (typeof kpi === 'string' ? kpi : JSON.stringify(kpi)) : null

  useEffect(() => {
    if (!cfg) return
    setCarregando(true)
    setSortCol(null)
    cfg.fetchFn()
      .then((r) => setDados(r.data))
      .catch(() => setDados([]))
      .finally(() => setCarregando(false))
  }, [kpiKey])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleSort(key) {
    if (sortCol === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortCol(null); setSortDir('asc') }
    } else {
      setSortCol(key)
      setSortDir('asc')
    }
  }

  const dadosOrdenados = useMemo(() => {
    if (!sortCol) return dados
    const col = cfg.colunas.find((c) => c.key === sortCol)
    return [...dados].sort((a, b) => {
      let va = a[sortCol]
      let vb = b[sortCol]
      if (va == null) va = col?.tipo === 'numero' ? -Infinity : ''
      if (vb == null) vb = col?.tipo === 'numero' ? -Infinity : ''
      let cmp
      if (col?.tipo === 'numero') {
        cmp = va - vb
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [dados, sortCol, sortDir, cfg])

  if (!kpi || !cfg) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 border-b border-slate-100 flex items-center justify-between px-6 py-4 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-700">{cfg.titulo}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {carregando ? (
            <div className="flex justify-center py-16">
              <div
                className="w-8 h-8 border-4 border-slate-200 rounded-full animate-spin"
                style={{ borderTopColor: '#0f4c5c' }}
              />
            </div>
          ) : dadosOrdenados.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-16">Nenhum registro encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  {cfg.colunas.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-left text-xs font-semibold text-slate-500 pb-2 pr-4 cursor-pointer select-none hover:text-slate-800 transition-colors whitespace-nowrap"
                    >
                      {col.label}
                      <SortIcon dir={sortCol === col.key ? sortDir : null} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dadosOrdenados.map((row, i) => (
                  <tr key={row.id ?? i} className="hover:bg-slate-50 transition-colors">
                    {cfg.colunas.map((col) => (
                      <td key={col.key} className="py-2.5 pr-4 text-slate-700">
                        {col.render ? col.render(row[col.key]) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {!carregando && dadosOrdenados.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 flex-shrink-0">
            <p className="text-xs text-slate-400">
              {dadosOrdenados.length} {dadosOrdenados.length === 1 ? 'registro' : 'registros'}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
