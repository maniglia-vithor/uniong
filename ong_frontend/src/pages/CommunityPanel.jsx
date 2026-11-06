import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HeartHandshake, DollarSign, Megaphone, Users,
  ShieldCheck, ExternalLink,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import axios from 'axios'
import BarraProgresso from '../components/BarraProgresso'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const CORES_CAMPANHA = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed']

export default function CommunityPanel() {
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    axios.get('/api/public/transparencia/')
      .then((r) => setDados(r.data))
      .catch(() => setErro('Não foi possível carregar os dados. Tente novamente mais tarde.'))
      .finally(() => setCarregando(false))
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f1f5f9' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#0f4c5c' }}
            >
              <HeartHandshake size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-tight">ONG Gestão</p>
              <p className="text-xs text-slate-400">Portal de Transparência</p>
            </div>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            <ShieldCheck size={13} />
            Área Restrita
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center py-4">
          <h1 className="text-3xl font-bold text-slate-800">Transparência em Números</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">
            Acompanhe em tempo real o impacto das nossas campanhas, o total arrecadado
            e como cada doação está sendo utilizada pela nossa comunidade.
          </p>
        </div>

        {carregando && (
          <div className="flex justify-center py-20">
            <div
              className="w-10 h-10 border-4 border-slate-200 rounded-full animate-spin"
              style={{ borderTopColor: '#0f4c5c' }}
            />
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600 text-sm">
            {erro}
          </div>
        )}

        {dados && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  label: 'Total Arrecadado',
                  valor: formatBRL(dados.kpis.total_arrecadado),
                  icone: DollarSign,
                  cor: '#0f4c5c',
                  desc: 'em todas as campanhas',
                },
                {
                  label: 'Campanhas Ativas',
                  valor: dados.kpis.campanhas_ativas,
                  icone: Megaphone,
                  cor: '#f97316',
                  desc: 'em andamento agora',
                },
                {
                  label: 'Apoiadores Ativos',
                  valor: dados.kpis.apoiadores_ativos,
                  icone: Users,
                  cor: '#0891b2',
                  desc: 'pessoas engajadas',
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-4"
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${kpi.cor}15` }}
                  >
                    <kpi.icone size={22} style={{ color: kpi.cor }} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{kpi.label}</p>
                    <p className="text-2xl font-bold text-slate-800 leading-tight">{kpi.valor}</p>
                    <p className="text-xs text-slate-400">{kpi.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Campanhas em Andamento */}
            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Megaphone size={18} style={{ color: '#f97316' }} />
                Campanhas em Andamento
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dados.campanhas.map((c, i) => {
                  const cor = CORES_CAMPANHA[i % CORES_CAMPANHA.length]
                  return (
                    <div
                      key={c.id}
                      className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-slate-800 leading-snug pr-2">{c.titulo}</h3>
                        <span
                          className="text-lg font-bold flex-shrink-0"
                          style={{ color: cor }}
                        >
                          {c.percentual_progresso}%
                        </span>
                      </div>
                      <BarraProgresso percentual={c.percentual_progresso} cor={cor} />
                      <div className="flex justify-between mt-3 text-sm">
                        <div>
                          <p className="text-xs text-slate-400">Arrecadado</p>
                          <p className="font-bold text-slate-700">{formatBRL(c.valor_arrecadado)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Meta</p>
                          <p className="font-semibold text-slate-500">{formatBRL(c.meta_valor)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {dados.campanhas.length === 0 && (
                  <p className="col-span-2 text-center py-8 text-slate-400 text-sm">
                    Nenhuma campanha ativa no momento.
                  </p>
                )}
              </div>
            </section>

            {/* Doações Recentes */}
            <section>
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <DollarSign size={18} style={{ color: '#0f4c5c' }} />
                Doações Recentes
                <span className="text-xs font-normal text-slate-400 ml-1">
                  (nomes parcialmente anonimizados para privacidade)
                </span>
              </h2>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Doador</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Campanha</th>
                      <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Valor</th>
                      <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {dados.doacoes_recentes.map((d, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700">{d.doador}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {d.campanha || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-slate-800">
                          {formatBRL(d.valor)}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{formatData(d.data)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between text-xs text-slate-400">
          <span>© {new Date().getFullYear()} ONG Gestão · Portal de Transparência</span>
          <Link to="/login" className="flex items-center gap-1 hover:text-slate-600 transition-colors">
            <ExternalLink size={11} /> Acesso Administrativo
          </Link>
        </div>
      </footer>
    </div>
  )
}
