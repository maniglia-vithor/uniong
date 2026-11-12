import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import api from '../services/api'
import { formatBRL, formatData, mensagemErro } from '../utils/formatos'

function Tabela({ cabecalho, linhas }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b-2 border-slate-400">
          {cabecalho.map((c, i) => (
            <th key={c} scope="col" className={`py-1.5 font-semibold ${i === cabecalho.length - 1 ? 'text-right' : 'text-left'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((linha, i) => (
          <tr key={i} className="border-b border-slate-200">
            {linha.map((celula, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j === linha.length - 1 ? 'text-right whitespace-nowrap' : ''}`}>{celula}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Relatório de prestação de contas em HTML imprimível (o navegador salva como PDF). */
export default function PrestacaoContasImpressao() {
  const [params] = useSearchParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    const filtros = {}
    if (params.get('data_inicio')) filtros.data_inicio = params.get('data_inicio')
    if (params.get('data_fim')) filtros.data_fim = params.get('data_fim')
    api.get('/relatorios/prestacao-contas/', { params: filtros })
      .then(({ data }) => setDados(data))
      .catch((err) => setErro(mensagemErro(err, 'Não foi possível gerar o relatório.')))
  }, [params])

  if (erro) return <p className="p-8 text-red-600" role="alert">{erro}</p>
  if (!dados) return <p className="p-8 text-slate-500">Gerando relatório…</p>

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="no-print flex items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50">
        <Link to="/admin/relatorios" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#0f4c5c' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar aos relatórios
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Printer size={15} aria-hidden="true" /> Imprimir / salvar em PDF
        </button>
      </div>

      <main className="max-w-3xl mx-auto px-8 py-10 space-y-8">
        <header className="border-b-2 border-slate-800 pb-4">
          {dados.instituicao?.nome && (
            <div className="flex items-center gap-3 mb-3">
              {dados.instituicao.logo_url && <img src={dados.instituicao.logo_url} alt="" className="h-12 w-12 object-contain" />}
              <div>
                <p className="font-bold">{dados.instituicao.nome}</p>
                <p className="text-xs text-slate-600">
                  {[dados.instituicao.cnpj_formatado && `CNPJ ${dados.instituicao.cnpj_formatado}`, dados.instituicao.endereco, dados.instituicao.email]
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
          )}
          <h1 className="text-2xl font-bold">Prestação de contas</h1>
          <p className="text-sm text-slate-600 mt-1">
            Período: {formatData(dados.data_inicio)} a {formatData(dados.data_fim)} · Gerado em {new Date(dados.gerado_em).toLocaleString('pt-BR')}
          </p>
        </header>

        <section className="grid grid-cols-3 gap-4 text-center">
          {[
            ['Receitas (doações confirmadas)', dados.total_receitas],
            ['Despesas pagas', dados.total_despesas],
            ['Saldo do período', dados.saldo],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="border border-slate-300 rounded-lg p-3">
              <p className="text-xs text-slate-600">{rotulo}</p>
              <p className="text-lg font-bold mt-1">{formatBRL(valor)}</p>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Receitas por campanha</h2>
          {dados.receitas_por_campanha.length === 0
            ? <p className="text-sm text-slate-600">Nenhuma doação confirmada no período.</p>
            : <Tabela cabecalho={['Campanha', 'Total']} linhas={dados.receitas_por_campanha.map((r) => [r.campanha, formatBRL(r.total)])} />}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Despesas por categoria</h2>
          {dados.despesas_por_categoria.length === 0
            ? <p className="text-sm text-slate-600">Nenhuma despesa paga no período.</p>
            : <Tabela cabecalho={['Categoria', 'Total']} linhas={dados.despesas_por_categoria.map((d) => [d.categoria, formatBRL(d.total)])} />}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Despesas pagas</h2>
          {dados.despesas_pagas.length === 0
            ? <p className="text-sm text-slate-600">Nenhuma despesa paga no período.</p>
            : (
              <Tabela
                cabecalho={['Data', 'Descrição', 'Categoria', 'Campanha', 'Valor']}
                linhas={dados.despesas_pagas.map((d) => [formatData(d.data_pagamento), d.descricao, d.categoria, d.campanha ?? '—', formatBRL(d.valor)])}
              />
            )}
        </section>

        <footer className="text-xs text-slate-500 border-t border-slate-300 pt-3">
          Relatório gerado com UniONG. Valores de doações consideram apenas as confirmadas; despesas, apenas as pagas no período.
        </footer>
      </main>
    </div>
  )
}
