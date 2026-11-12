import BarraProgresso from './BarraProgresso'
import { formatBRL, formatData } from '../utils/formatos'

/** Progresso e números da campanha (arrecadado, meta, gasto, saldo e datas) para o portal. */
export default function ResumoCampanha({ campanha }) {
  const itens = [
    { label: 'Arrecadado', valor: formatBRL(campanha.valor_arrecadado) },
    { label: 'Meta', valor: formatBRL(campanha.meta_valor) },
    { label: 'Gasto (despesas pagas)', valor: formatBRL(campanha.valor_gasto) },
    { label: 'Saldo da campanha', valor: formatBRL(campanha.saldo) },
    { label: 'Início', valor: formatData(campanha.data_inicio) },
    { label: 'Encerramento', valor: campanha.data_fim ? formatData(campanha.data_fim) : 'Em aberto' },
  ]
  return (
    <div className="space-y-5">
      <div>
        <div className="flex justify-between mb-1.5 text-xs">
          <span className="text-[var(--text-muted)]">Progresso{campanha.meta_atingida ? ' — meta atingida!' : ''}</span>
          <span className="font-semibold text-[var(--text-primary)]">{campanha.percentual_progresso}%</span>
        </div>
        <BarraProgresso percentual={campanha.percentual_progresso} cor="#0f4c5c" />
      </div>
      <dl className="grid grid-cols-2 border border-[var(--border)] rounded-lg divide-x divide-y divide-[var(--border)] overflow-hidden">
        {itens.map((item) => (
          <div key={item.label} className="px-4 py-3">
            <dt className="text-xs text-[var(--text-muted)]">{item.label}</dt>
            <dd className="text-sm font-semibold text-[var(--text-primary)] mt-0.5">{item.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
