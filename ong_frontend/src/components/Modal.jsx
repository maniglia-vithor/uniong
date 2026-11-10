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
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-[var(--border)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text-primary)]">{titulo}</h3>
          <button
            onClick={onFechar}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
