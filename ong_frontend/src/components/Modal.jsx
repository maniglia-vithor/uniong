import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ titulo, onFechar, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onFechar()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onFechar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,76,92,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">{titulo}</h3>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
