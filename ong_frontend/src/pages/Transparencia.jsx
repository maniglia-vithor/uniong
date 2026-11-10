import { useEffect, useState } from 'react'
import {
  HeartHandshake, DollarSign, Megaphone, Users, TrendingUp,
  Receipt, ShieldOff,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import axios from 'axios'
import BarraProgresso from '../components/BarraProgresso'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const CORES_CAMPANHA = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed']
const CORES_PIE = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed', '#10b981', '#ec4899']

function KpiCard({ label, valor, desc, icone: Icon, cor }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${cor}22` }}
      >
        <Icon size={22} style={{ color: cor }} />
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight">{valor}</p>
        <p className="text-xs text-[var(--text-muted)]">{desc}</p>
      </div>
    </div>
  )
}

export default function Transparencia() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    axios.get('/api/public/transparencia/')
      .then((r) => setDados(r.data))
      .catch(() => setErro('Não foi possível carregar os dados. Verifique a conexão com o servidor.'))
      .finally(() => setCarregando(false))
  }, [])

  const dadosGraficoMensal = dados?.doacoes_por_mes ?? []

  const dadosGraficoCampanhas = dados?.campanhas?.map(c => ({
    name: c.titulo.length > 20 ? c.titulo.slice(0, 18) + '…' : c.titulo,
    arrecadado: Number(c.valor_arrecadado),
    meta: Number(c.meta_valor),
  })) ?? []

  const dadosPie = dados?.campanhas?.map((c, i) => ({
    name: c.titulo.length > 20 ? c.titulo.slice(0, 18) + '…' : c.titulo,
    value: Number(c.valor_arrecadado),
    fill: CORES_PIE[i % CORES_PIE.length],
  })).filter(c => c.value > 0) ?? []

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-6 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <HeartHandshake size={26} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Portal de Transparência</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5 max-w-xl">
            Acompanhe em tempo real o impacto das campanhas, o total arrecadado e como os recursos
            estão sendo utilizados pela organização.
          </p>
        </div>
      </div>

      {carregando && (
        <div className="flex justify-center py-24">
          <div
            className="w-10 h-10 border-4 border-[var(--border)] rounded-full animate-spin"
            style={{ borderTopColor: '#0f4c5c' }}
          />
        </div>
      )}

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3 text-red-600 text-sm">
          <ShieldOff size={20} className="flex-shrink-0" />
          {erro}
        </div>
      )}

      {dados && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Total Arrecadado"
              valor={formatBRL(dados.kpis.total_arrecadado)}
              desc="em todas as campanhas"
              icone={DollarSign}
              cor="#0f4c5c"
            />
            <KpiCard
              label="Campanhas Ativas"
              valor={dados.kpis.campanhas_ativas}
              desc="em andamento agora"
              icone={Megaphone}
              cor="#f97316"
            />
            <KpiCard
              label="Membros Ativos"
              valor={dados.kpis.apoiadores_ativos}
              desc="pessoas engajadas"
              icone={Users}
              cor="#0891b2"
            />
            <KpiCard
              label="Doações Registradas"
              valor={dados.doacoes_recentes?.length ?? 0}
              desc="nas últimas operações"
              icone={TrendingUp}
              cor="#7c3aed"
            />
          </div>

          {/* Campanhas em Andamento */}
          <section>
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Megaphone size={16} style={{ color: '#f97316' }} />
              Campanhas em Andamento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dados.campanhas.map((c, i) => {
                const cor = CORES_CAMPANHA[i % CORES_CAMPANHA.length]
                return (
                  <div
                    key={c.id}
                    className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-[var(--text-primary)] leading-snug pr-2">{c.titulo}</h3>
                      <span className="text-lg font-bold flex-shrink-0" style={{ color: cor }}>
                        {c.percentual_progresso}%
                      </span>
                    </div>
                    <BarraProgresso percentual={c.percentual_progresso} cor={cor} />
                    <div className="flex justify-between mt-3 text-sm">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">Arrecadado</p>
                        <p className="font-bold text-[var(--text-primary)]">{formatBRL(c.valor_arrecadado)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[var(--text-muted)]">Meta</p>
                        <p className="font-semibold text-[var(--text-secondary)]">{formatBRL(c.meta_valor)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {dados.campanhas.length === 0 && (
                <p className="col-span-2 text-center py-10 text-[var(--text-muted)] text-sm">
                  Nenhuma campanha ativa no momento.
                </p>
              )}
            </div>
          </section>

          {/* Gráficos */}
          {dadosGraficoCampanhas.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* Bar: Arrecadado vs Meta */}
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <TrendingUp size={15} style={{ color: '#0f4c5c' }} />
                  Arrecadado vs Meta por Campanha
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dadosGraficoCampanhas} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v) => formatBRL(v)}
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="arrecadado" name="Arrecadado" fill="#0f4c5c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="meta" name="Meta" fill="#f97316" opacity={0.5} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Pie: Distribuição */}
              {dadosPie.length > 0 && (
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <Receipt size={15} style={{ color: '#7c3aed' }} />
                    Distribuição de Arrecadação
                  </h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={dadosPie}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {dadosPie.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => formatBRL(v)}
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Doações Recentes */}
          <section>
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <DollarSign size={16} style={{ color: '#0f4c5c' }} />
              Doações Recentes
              <span className="text-xs font-normal text-[var(--text-muted)] ml-1">
                (nomes parcialmente anonimizados)
              </span>
            </h2>
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Doador</th>
                    <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Campanha</th>
                    <th className="text-right text-xs font-medium text-[var(--text-muted)] px-5 py-3">Valor</th>
                    <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {dados.doacoes_recentes.map((d, i) => (
                    <tr key={i} className="hover:bg-[var(--bg-hover)] transition-colors">
                      <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{d.doador}</td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">
                        {d.campanha || <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">
                        {formatBRL(d.valor)}
                      </td>
                      <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(d.data)}</td>
                    </tr>
                  ))}
                  {dados.doacoes_recentes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">
                        Nenhuma doação registrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Rodapé informativo */}
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 flex items-start gap-3 text-sm text-[var(--text-muted)]">
            <HeartHandshake size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#0f4c5c' }} />
            <p>
              Todos os dados exibidos são públicos e atualizados em tempo real.
              Esta página reflete o compromisso da organização com a transparência e prestação de contas à comunidade.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
