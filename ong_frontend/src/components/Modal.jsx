import { X } from 'lucide-react'
import useDialogo from '../hooks/useDialogo'

export default function Modal({ titulo, onFechar, children }) {
  const { ref, tituloId } = useDialogo(onFechar)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15,76,92,0.35)', backdropFilter: 'blur(2px)' }}
      onClick={(e) => e.target === e.currentTarget && onFechar()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        className="bg-[var(--bg-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-[var(--border)] outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 id={tituloId} className="font-semibold text-[var(--text-primary)]">{titulo}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}
