export default function BarraProgresso({ percentual, cor = '#0f4c5c' }) {
  const pct = Math.min(Math.max(percentual, 0), 100)
  return (
    <div className="w-full bg-slate-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor }}
      />
    </div>
  )
}
