import DatePicker, { registerLocale } from 'react-datepicker'
import { ptBR } from 'date-fns/locale'
import { parseISO, format, isValid } from 'date-fns'
import 'react-datepicker/dist/react-datepicker.css'

registerLocale('pt-BR', ptBR)

// Converte string ISO "yyyy-MM-dd" → Date (ou null)
function isoParaDate(iso) {
  if (!iso) return null
  const d = parseISO(iso)
  return isValid(d) ? d : null
}

// Converte Date → string ISO "yyyy-MM-dd" (ou "")
function dateParaIso(d) {
  if (!d || !isValid(d)) return ''
  return format(d, 'yyyy-MM-dd')
}

/**
 * Substituto de <Input type="date" /> com calendário em português.
 *
 * Props compatíveis com o Input existente:
 *   name, value (ISO string), onChange (evento sintético com target.name + target.value),
 *   required, placeholder
 *
 * Uso:
 *   <CampoData name="data_inicio" value={form.data_inicio} onChange={onChange} required />
 */
export default function CampoData({ name, value, onChange, required, placeholder, disabled }) {
  function handleChange(date) {
    // Emula o evento sintético esperado pelos handlers existentes
    onChange({ target: { name, value: dateParaIso(date) } })
  }

  return (
    <DatePicker
      locale="pt-BR"
      selected={isoParaDate(value)}
      onChange={handleChange}
      dateFormat="dd/MM/yyyy"
      placeholderText={placeholder ?? 'dd/mm/aaaa'}
      required={required}
      disabled={disabled}
      autoComplete="off"
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      className="w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-offset-0 border-[var(--border)] focus:border-teal-500 focus:ring-teal-100 bg-[var(--bg-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)]"
      wrapperClassName="w-full"
      popperClassName="z-[9999]"
    />
  )
}
