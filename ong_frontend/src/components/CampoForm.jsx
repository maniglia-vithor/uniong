import { Children, cloneElement, isValidElement, useId } from 'react'

/**
 * Rótulo + campo. O <label> é associado ao último elemento filho (o campo) por id, e a mensagem de
 * erro é ligada a ele por aria-describedby e aria-invalid.
 */
export function Campo({ label, erro, children }) {
  const base = useId()
  const erroId = erro ? `${base}-erro` : undefined
  const filhos = Children.toArray(children)
  const indice = filhos.findLastIndex((f) => isValidElement(f))
  let campoId
  if (indice >= 0) {
    const alvo = filhos[indice]
    campoId = alvo.props.id ?? `${base}-campo`
    const descritos = [alvo.props['aria-describedby'], erroId].filter(Boolean).join(' ') || undefined
    filhos[indice] = cloneElement(alvo, { id: campoId, 'aria-describedby': descritos, 'aria-invalid': erro ? true : alvo.props['aria-invalid'] })
  }
  return (
    <div>
      <label htmlFor={campoId} className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      {filhos}
      {erro && <p id={erroId} className="text-xs text-red-600 mt-1">{erro}</p>}
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
