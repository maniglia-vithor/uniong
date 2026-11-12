import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatBRL } from '../utils/formatos'

const ROTULOS = { receitas: 'Receitas', despesas: 'Despesas', saldo_acumulado: 'Saldo acumulado' }

/** Receitas × despesas por mês (barras agrupadas) e linha de saldo acumulado, com alternativa em tabela. */
export default function GraficoFluxo({ dados, titulo, descricao, altura = 260 }) {
  const [tabela, setTabela] = useState(false)
  return (
    <figure className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{titulo}</h2>
        <button
          type="button"
          onClick={() => setTabela((v) => !v)}
          className="text-xs font-medium underline flex-shrink-0"
          style={{ color: 'var(--marca-texto)' }}
          aria-pressed={tabela}
        >
          {tabela ? 'Ver como gráfico' : 'Ver como tabela'}
        </button>
      </div>
      <figcaption className="text-xs text-[var(--text-muted)] mb-4">{descricao}</figcaption>

      {tabela ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                <th scope="col" className="text-left py-2 pr-3">Mês</th>
                <th scope="col" className="text-right py-2 px-3">Receitas</th>
                <th scope="col" className="text-right py-2 px-3">Despesas</th>
                <th scope="col" className="text-right py-2 px-3">Saldo do mês</th>
                <th scope="col" className="text-right py-2 pl-3">Saldo acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {dados.map((m) => (
                <tr key={m.isoMes}>
                  <th scope="row" className="text-left py-2 pr-3 font-medium text-[var(--text-primary)]">{m.mes}</th>
                  <td className="text-right py-2 px-3">{formatBRL(m.receitas)}</td>
                  <td className="text-right py-2 px-3">{formatBRL(m.despesas)}</td>
                  <td className="text-right py-2 px-3">{formatBRL(m.saldo)}</td>
                  <td className="text-right py-2 pl-3">{formatBRL(m.saldo_acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={`${titulo}. Use "Ver como tabela" para ler os valores.`}>
          <ResponsiveContainer width="100%" height={altura}>
            <ComposedChart data={dados} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(valor, nome) => [formatBRL(valor), ROTULOS[nome] ?? nome]}
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Legend formatter={(nome) => ROTULOS[nome] ?? nome} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receitas" fill="#0f4c5c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesas" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="saldo_acumulado" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </figure>
  )
}
