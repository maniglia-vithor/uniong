const config = {
  confirmada: { label: 'Confirmada', cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' },
  pendente:   { label: 'Pendente',   cls: 'bg-amber-500/10  text-amber-600  border border-amber-500/20  dark:bg-amber-500/15  dark:text-amber-400  dark:border-amber-500/30'  },
  cancelada:  { label: 'Cancelada',  cls: 'bg-rose-500/10   text-rose-600   border border-rose-500/20   dark:bg-rose-500/15   dark:text-rose-400   dark:border-rose-500/30'   },
  ativa:      { label: 'Ativa',      cls: 'bg-blue-500/10   text-blue-600   border border-blue-500/20   dark:bg-blue-500/15   dark:text-blue-400   dark:border-blue-500/30'   },
  encerrada:  { label: 'Encerrada',  cls: 'bg-slate-500/10  text-slate-500  border border-slate-500/20  dark:bg-slate-500/15  dark:text-slate-400  dark:border-slate-500/30'  },
  pausada:    { label: 'Pausada',    cls: 'bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30' },
  pago:       { label: 'Pago',       cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' },
  atrasado:   { label: 'Atrasado',   cls: 'bg-rose-500/10   text-rose-600   border border-rose-500/20   dark:bg-rose-500/15   dark:text-rose-400   dark:border-rose-500/30'   },
  ativo:      { label: 'Ativo',      cls: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' },
  inativo:    { label: 'Inativo',    cls: 'bg-rose-500/10   text-rose-600   border border-rose-500/20   dark:bg-rose-500/15   dark:text-rose-400   dark:border-rose-500/30'   },
  interessado:{ label: 'Interessado', cls: 'bg-violet-500/10 text-violet-600 border border-violet-500/20 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-slate-500/10  text-slate-500  border border-slate-500/20  dark:bg-slate-500/15  dark:text-slate-400  dark:border-slate-500/30'  },
}

export default function BadgeStatus({ status }) {
  const s = config[status] || {
    label: status ? status.charAt(0).toUpperCase() + status.slice(1) : '—',
    cls: 'bg-slate-500/10 text-slate-500 border border-slate-500/20 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
