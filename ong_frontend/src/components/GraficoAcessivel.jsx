import { useState } from 'react'

/**
 * Envolve um gráfico com descrição textual e alternativa em tabela (botão "Ver como tabela").
 * colunas: [{ chave, rotulo, formato?: (valor, linha) => texto, numerica?: bool }]; a primeira coluna é o rótulo da linha.
 */
export default function GraficoAcessivel({ titulo, descricao, colunas, linhas, children, cabecalho = null, className = '' }) {
  const [tabela, setTabela] = useState(false)
  const [primeira, ...demais] = colunas
  const celula = (c, l) => (c.formato ? c.formato(l[c.chave], l) : l[c.chave])

  return (
    <figure className={className}>
      <div className="flex items-start justify-between gap-3 mb-1">
        {cabecalho ?? <h2 className="text-sm font-semibold text-[var(--text-primary)]">{titulo}</h2>}
        {linhas.length > 0 && (
          <button
            type="button"
            onClick={() => setTabela((v) => !v)}
            className="text-xs font-medium underline flex-shrink-0"
            style={{ color: 'var(--marca-texto)' }}
            aria-pressed={tabela}
          >
            {tabela ? 'Ver como gráfico' : 'Ver como tabela'}
          </button>
        )}
      </div>
      {descricao && <figcaption className="text-xs text-[var(--text-muted)] mb-3">{descricao}</figcaption>}
      {tabela ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                {colunas.map((c, i) => (
                  <th key={c.chave} scope="col" className={`py-2 px-2 ${i === 0 ? 'text-left' : 'text-right'}`}>{c.rotulo}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
              {linhas.map((l, i) => (
                <tr key={i}>
                  <th scope="row" className="text-left py-2 px-2 font-medium text-[var(--text-primary)]">{celula(primeira, l)}</th>
                  {demais.map((c) => <td key={c.chave} className="text-right py-2 px-2 whitespace-nowrap">{celula(c, l)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={`${titulo}.${linhas.length ? ' Use "Ver como tabela" para ler os valores.' : ''}`}>
          {children}
        </div>
      )}
    </figure>
  )
}
