import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'

export function IconeOrdenacao({ dir }) {
  if (dir === 'asc') return <ChevronUp size={12} className="inline-block ml-1" />
  if (dir === 'desc') return <ChevronDown size={12} className="inline-block ml-1" />
  return <ChevronsUpDown size={12} className="inline-block ml-1 opacity-30" />
}

export function CabecalhoOrdenavel({ campo, rotulo, lista, alinhamento = 'left' }) {
  const dir = lista.direcao(campo)
  return (
    <th
      onClick={() => lista.alternarOrdenacao(campo)}
      aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
      className={`text-${alinhamento} text-xs font-medium text-[var(--text-muted)] px-5 py-3 cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors whitespace-nowrap`}
    >
      {rotulo}<IconeOrdenacao dir={dir} />
    </th>
  )
}

export function CampoBusca({ valor, onMudar, placeholder = 'Buscar...' }) {
  return (
    <div className="relative w-full sm:w-72">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
      />
    </div>
  )
}
