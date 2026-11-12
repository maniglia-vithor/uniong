import { useEffect, useState } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Scale } from 'lucide-react'
import GraficoFluxo from './GraficoFluxo'
import { formatBRL, corDeTexto } from '../utils/formatos'
import GraficoAcessivel from './GraficoAcessivel'

const CORES = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed', '#64748b']

/** Prestação de contas pública por ano: recebido, gasto, saldo, gasto por categoria e evolução mensal. */
export default function PrestacaoContas() {
  const [ano, setAno] = useState(null)
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    const params = ano ? { ano } : {}
    axios.get('/api/public/prestacao-contas/', { params })
      .then(({ data }) => { setDados(data); setErro(false) })
      .catch(() => setErro(true))
  }, [ano])

  if (erro) return null
  if (!dados) return null

  const totais = [
    { rotulo: 'Total recebido', valor: dados.total_recebido, cor: '#0f4c5c' },
    { rotulo: 'Total gasto', valor: dados.total_gasto, cor: '#f97316' },
    { rotulo: 'Saldo do ano', valor: dados.saldo, cor: dados.saldo >= 0 ? '#16a34a' : '#dc2626' },
  ]

  return (
    <section aria-labelledby="titulo-prestacao" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-prestacao" className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Scale size={16} style={{ color: 'var(--marca-texto)' }} aria-hidden="true" />
          Prestação de contas
        </h2>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          Ano
          <select
            value={dados.ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-primary)]"
          >
            {dados.anos_disponiveis.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        Valores agregados: doações confirmadas e despesas pagas no ano, sem identificar doadores.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {totais.map((t) => (
          <div key={t.rotulo} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{t.rotulo}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: corDeTexto(t.cor) }}>{formatBRL(t.valor)}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
          {dados.gasto_por_categoria.length === 0 ? (
            <>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Gasto por categoria</h3>
              <p className="text-sm text-[var(--text-muted)] py-10 text-center">Sem despesas pagas no ano.</p>
            </>
          ) : (
            <GraficoAcessivel
              titulo="Gasto por categoria"
              cabecalho={<h3 className="text-sm font-semibold text-[var(--text-primary)]">Gasto por categoria</h3>}
              descricao={dados.gasto_por_categoria.map((c) => `${c.label}: ${formatBRL(c.total)}`).join('; ')}
              colunas={[{ chave: 'label', rotulo: 'Categoria' }, { chave: 'total', rotulo: 'Pago', formato: (v) => formatBRL(v) }]}
              linhas={dados.gasto_por_categoria}
            >
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={dados.gasto_por_categoria} dataKey="total" nameKey="label" innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {dados.gasto_por_categoria.map((c, i) => <Cell key={c.categoria} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatBRL(v)} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </GraficoAcessivel>
          )}
        </div>
        <div className="xl:col-span-2">
          <GraficoFluxo
            dados={dados.evolucao_mensal}
            titulo={`Evolução mensal em ${dados.ano}`}
            descricao="Receitas (doações confirmadas) e despesas pagas por mês, com o saldo acumulado da organização."
          />
        </div>
      </div>
    </section>
  )
}
