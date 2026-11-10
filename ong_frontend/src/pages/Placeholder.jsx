export default function Placeholder({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm">
      <p className="text-2xl font-bold text-slate-200">{titulo}</p>
      <p className="text-sm text-[var(--text-muted)] mt-2">Em desenvolvimento</p>
    </div>
  )
}
