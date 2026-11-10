export function Campo({ label, erro, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      {children}
      {erro && <p className="text-xs text-red-500 mt-1">{erro}</p>}
    </div>
  )
}

const base =
  'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-offset-0 border-[var(--border)] focus:border-teal-500 focus:ring-teal-100 bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)]'

export function Input(props) {
  return <input className={base} {...props} />
}

export function Select({ children, ...props }) {
  return (
    <select className={base} {...props}>
      {children}
    </select>
  )
}

export function BotaoSubmit({ carregando, label = 'Salvar' }) {
  return (
    <button
      type="submit"
      disabled={carregando}
      className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60"
      style={{ backgroundColor: '#0f4c5c' }}
    >
      {carregando ? 'Salvando...' : label}
    </button>
  )
}

export function BotaoCancelar({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] transition-colors border border-[var(--border)]"
    >
      Cancelar
    </button>
  )
}
