import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Paginacao({ pagina, total, tamanhoPagina, onMudar }) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina))
  if (total <= tamanhoPagina) {
    return total > 0 ? (
      <p className="text-xs text-[var(--text-muted)] px-5 py-3">{total} registro{total !== 1 ? 's' : ''}</p>
    ) : null
  }
  const inicio = (pagina - 1) * tamanhoPagina + 1
  const fim = Math.min(pagina * tamanhoPagina, total)
  const botao = 'p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  return (
    <nav className="flex items-center justify-between gap-3 px-5 py-3 text-xs text-[var(--text-muted)]" aria-label="Paginação">
      <span>{inicio}–{fim} de {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" className={botao} onClick={() => onMudar(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior">
          <ChevronLeft size={14} />
        </button>
        <span className="text-[var(--text-secondary)]">Página {pagina} de {totalPaginas}</span>
        <button type="button" className={botao} onClick={() => onMudar(pagina + 1)} disabled={pagina >= totalPaginas} aria-label="Próxima página">
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  )
}
