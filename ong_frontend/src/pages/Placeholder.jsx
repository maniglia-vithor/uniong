export default function Placeholder({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-slate-100 shadow-sm">
      <p className="text-2xl font-bold text-slate-200">{titulo}</p>
      <p className="text-sm text-slate-400 mt-2">Em desenvolvimento</p>
    </div>
  )
}
