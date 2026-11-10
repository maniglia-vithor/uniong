import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DollarSign, CalendarDays, Users, Megaphone } from 'lucide-react'
import KpiCard from '../components/KpiCard'
import KpiDetailPanel from '../components/KpiDetailPanel'
import BarraProgresso from '../components/BarraProgresso'
import BadgeStatus from '../components/BadgeStatus'
import {
  getDashboardResumo, getGraficoMensal, getDoacoesRecentes,
  getTopApoiadores, getCampanhasAtivas,
} from '../services/api'

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function iniciais(nome) {
  return nome
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed', '#16a34a']

function BarraClicavel(props) {
  const { x, y, width, height, chartHeight, fill, onClick } = props
  const alturaTotal = (chartHeight ?? 220) - (props.offset ?? 0)
  const r = 4
  const hVis = Math.max(height, 0)
  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* área invisível com altura total — garante clique mesmo em barras com h=0 */}
      <rect x={x} y={props.background?.y ?? 0} width={width} height={props.background?.height ?? alturaTotal} fill="transparent" />
      {hVis > 0 && (
        <path
          d={`M${x},${y + r} a${r},${r} 0 0 1 ${r},-${r} h${width - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${hVis - r} h-${width} z`}
          fill={fill}
        />
      )}
    </g>
  )
}

export default function Dashboard() {
  const [resumo, setResumo] = useState(null)
  const [grafico, setGrafico] = useState([])
  const [doacoes, setDoacoes] = useState([])
  const [topApoiadores, setTopApoiadores] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [painelKpi, setPainelKpi] = useState(null)

  useEffect(() => {
    Promise.all([
      getDashboardResumo(),
      getGraficoMensal(),
      getDoacoesRecentes(),
      getTopApoiadores(),
      getCampanhasAtivas(),
    ])
      .then(([r, g, d, t, c]) => {
        setResumo(r.data)
        setGrafico(g.data)
        setDoacoes(d.data)
        setTopApoiadores(t.data)
        setCampanhas(c.data)
      })
      .catch(() => setErro('Não foi possível carregar os dados. Verifique se o servidor está rodando.'))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
      </div>
    )
  }

  if (erro) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">{erro}</p>
      </div>
    )
  }

  const kpis = [
    {
      id: 'total_arrecadado',
      titulo: 'Total Arrecadado',
      valor: formatBRL(resumo.total_arrecadado.value),
      trend_percentage: resumo.total_arrecadado.trend_percentage,
      trend_direction: resumo.total_arrecadado.trend_direction,
      icone: DollarSign,
      cor: '#0f4c5c',
    },
    {
      id: 'doacoes_mes',
      titulo: 'Doações do Mês',
      valor: formatBRL(resumo.doacoes_mes.value),
      trend_percentage: resumo.doacoes_mes.trend_percentage,
      trend_direction: resumo.doacoes_mes.trend_direction,
      icone: CalendarDays,
      cor: '#f97316',
    },
    {
      id: 'apoiadores_ativos',
      titulo: 'Membros Ativos',
      valor: resumo.apoiadores_ativos.value,
      trend_percentage: resumo.apoiadores_ativos.trend_percentage,
      trend_direction: resumo.apoiadores_ativos.trend_direction,
      icone: Users,
      cor: '#0891b2',
    },
    {
      id: 'campanhas_ativas',
      titulo: 'Campanhas Ativas',
      valor: resumo.campanhas_ativas.value,
      trend_percentage: resumo.campanhas_ativas.trend_percentage,
      trend_direction: resumo.campanhas_ativas.trend_direction,
      icone: Megaphone,
      cor: '#7c3aed',
    },
  ]

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.titulo} {...kpi} onClick={() => setPainelKpi(kpi.id)} />
        ))}
      </div>

      <KpiDetailPanel kpi={painelKpi} onClose={() => setPainelKpi(null)} />

      {/* Campanhas + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campanhas em andamento */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Campanhas em Andamento</h2>
          <div className="space-y-5">
            {campanhas.map((c, i) => (
              <div key={c.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[60%]">{c.titulo}</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: i % 2 === 0 ? '#0f4c5c' : '#f97316' }}
                  >
                    {c.percentual_progresso}%
                  </span>
                </div>
                <BarraProgresso
                  percentual={c.percentual_progresso}
                  cor={i % 2 === 0 ? '#0f4c5c' : '#f97316'}
                />
                <div className="flex justify-between mt-1.5 text-xs text-[var(--text-muted)]">
                  <span>{formatBRL(c.valor_arrecadado)} arrecadados</span>
                  <span>Meta: {formatBRL(c.meta_valor)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico mensal */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Arrecadação Mensal (últimos 12 meses)</h2>
          <ResponsiveContainer width="100%" height={220} style={{ outline: 'none' }}>
            <BarChart
              data={grafico}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => [formatBRL(value), 'Arrecadado']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar
                dataKey="total"
                fill="#0f4c5c"
                background={{ fill: 'transparent' }}
                shape={(props) => (
                  <BarraClicavel
                    {...props}
                    onClick={() => setPainelKpi({ type: 'mes', mes: props.mes, isoMes: props.isoMes })}
                  />
                )}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Doações recentes + Top Apoiadores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Tabela de doações */}
        <div className="lg:col-span-2 bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Doações Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] pb-2 pr-4">Doador</th>
                  <th className="text-right text-xs font-medium text-[var(--text-muted)] pb-2 pr-4">Valor</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] pb-2 pr-4">Data</th>
                  <th className="text-left text-xs font-medium text-[var(--text-muted)] pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {doacoes.map((d) => (
                  <tr key={d.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#0f4c5c' }}
                        >
                          {iniciais(d.apoiador_nome)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)] truncate max-w-[140px]">{d.apoiador_nome}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-[var(--text-primary)]">
                      {formatBRL(d.valor)}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--text-secondary)]">{formatData(d.data)}</td>
                    <td className="py-2.5">
                      <BadgeStatus status={d.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Apoiadores */}
        <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Top Membros</h2>
          <div className="space-y-3">
            {topApoiadores.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                >
                  {iniciais(a.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{a.nome}</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatBRL(a.total_doado)} doados</p>
                </div>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#f97316' + '20', color: '#f97316' }}
                >
                  #{i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
