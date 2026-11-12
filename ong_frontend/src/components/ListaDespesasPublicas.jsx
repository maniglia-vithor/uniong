import { FileText } from 'lucide-react'
import { formatBRL } from '../utils/formatos'

/** Tabela de despesas para o portal: descrição pública, categoria, valor e comprovantes públicos. */
export default function ListaDespesasPublicas({ lista, vazio = 'Nenhum gasto registrado.' }) {
  if (lista.length === 0) {
    return <p className="text-center py-8 text-[var(--text-muted)] text-sm">{vazio}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] py-2">Descrição</th>
            <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] py-2">Categoria</th>
            <th scope="col" className="text-right text-xs font-medium text-[var(--text-muted)] py-2">Valor</th>
            <th scope="col" className="py-2"><span className="sr-only">Comprovantes</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {lista.map((g, i) => (
            <tr key={i} className="hover:bg-[var(--bg-hover)]">
              <td className="py-2.5 text-[var(--text-primary)] font-medium pr-4">{g.descricao}</td>
              <td className="py-2.5 text-[var(--text-secondary)] pr-4">{g.categoria}</td>
              <td className="py-2.5 text-right font-semibold text-[var(--text-primary)] whitespace-nowrap">{formatBRL(g.valor)}</td>
              <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                {(g.comprovantes ?? []).map((url, j) => (
                  <a
                    key={url}
                    href={url}
                    className="inline-flex items-center gap-1 text-xs font-medium hover:underline ml-2"
                    style={{ color: 'var(--marca-texto)' }}
                    aria-label={`Baixar comprovante ${j + 1} de ${g.descricao}`}
                  >
                    <FileText size={13} aria-hidden="true" /> Comprovante
                  </a>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
