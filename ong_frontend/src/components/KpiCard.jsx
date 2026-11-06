import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function KpiCard({ titulo, valor, trend_percentage, trend_direction, icone: Icone, cor, onClick }) {
  const isPositive = trend_direction === 'positive'
  const isNegative = trend_direction === 'negative'

  const trendColor = isPositive ? 'text-emerald-600' : isNegative ? 'text-red-500' : 'text-slate-400'
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  const pct = trend_percentage ?? 0
  const pctLabel = pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-5 shadow-sm border border-slate-100 transition-all duration-150 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:border-slate-200 active:scale-[1.00]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{titulo}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{valor}</p>
        </div>
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${cor}15` }}
        >
          <Icone size={20} style={{ color: cor }} />
        </div>
      </div>
      <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${trendColor}`}>
        <TrendIcon size={13} />
        <span>{pctLabel} em relação ao mês anterior</span>
      </div>
    </div>
  )
}
