import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function rotuloPadrao(pct) {
  if (pct === null || pct === undefined) return null
  if (pct === 0) return '0% em relação ao mês anterior'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}% em relação ao mês anterior`
}

export default function KpiCard({ titulo, valor, trend_percentage, trend_direction, rotuloTendencia, icone: Icone, cor, onClick }) {
  const isPositive = trend_direction === 'positive'
  const isNegative = trend_direction === 'negative'
  const semBase = trend_percentage === null || trend_percentage === undefined

  const trendColor = isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-[var(--text-muted)]'
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus
  const legenda = rotuloTendencia ?? rotuloPadrao(trend_percentage) ?? '— sem base de comparação no mês anterior'

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left bg-[var(--bg-card)] rounded-xl p-5 shadow-sm border border-[var(--border)] transition-all duration-150 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[1.00]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{titulo}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{valor}</p>
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${cor}22` }}
          aria-hidden="true"
        >
          <Icone size={20} style={{ color: cor }} />
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${semBase && !rotuloTendencia ? 'text-[var(--text-muted)]' : trendColor}`}>
        <TrendIcon size={13} aria-hidden="true" />
        <span>{legenda}</span>
      </div>
    </Tag>
  )
}
