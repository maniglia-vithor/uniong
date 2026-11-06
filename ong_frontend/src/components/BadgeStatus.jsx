const config = {
  confirmada: { label: 'Confirmada', bg: '#dcfce7', color: '#16a34a' },
  pendente:   { label: 'Pendente',   bg: '#fef9c3', color: '#ca8a04' },
  cancelada:  { label: 'Cancelada',  bg: '#fee2e2', color: '#dc2626' },
  ativa:      { label: 'Ativa',      bg: '#dbeafe', color: '#2563eb' },
  encerrada:  { label: 'Encerrada',  bg: '#f1f5f9', color: '#64748b' },
  pausada:    { label: 'Pausada',    bg: '#fef3c7', color: '#d97706' },
  pago:       { label: 'Pago',       bg: '#dcfce7', color: '#16a34a' },
  atrasado:   { label: 'Atrasado',   bg: '#fee2e2', color: '#dc2626' },
}

export default function BadgeStatus({ status }) {
  const s = config[status] || { label: status, bg: '#f1f5f9', color: '#64748b' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
