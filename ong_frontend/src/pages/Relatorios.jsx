import { useState } from 'react'
import { Download, HandCoins, Megaphone, Users, CheckCircle, AlertCircle, Receipt, Scale } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CampoData from '../components/CampoData'
import { downloadRelatorio } from '../services/api'

const RELATORIOS = [
  {
    tipo: 'doacoes',
    titulo: 'Relatório de Doações',
    descricao: 'Doações com membro, campanha, valor, data e status. O período se aplica à data da doação.',
    icone: HandCoins,
    cor: '#0f4c5c',
    arquivo: 'relatorio_doacoes.csv',
    status: [['confirmada', 'Confirmadas'], ['pendente', 'Pendentes'], ['cancelada', 'Canceladas']],
  },
  {
    tipo: 'campanhas',
    titulo: 'Desempenho das Campanhas',
    descricao: 'Campanhas com meta, arrecadado, progresso e status. O período se aplica à data de início.',
    icone: Megaphone,
    cor: '#f97316',
    arquivo: 'relatorio_campanhas.csv',
    status: [['ativa', 'Ativas'], ['pausada', 'Pausadas'], ['encerrada', 'Encerradas']],
  },
  {
    tipo: 'apoiadores',
    titulo: 'Lista de Membros',
    descricao: 'Membros com e-mail, celular, cadastro, status e total doado. O período se aplica à data de cadastro.',
    icone: Users,
    cor: '#0891b2',
    arquivo: 'relatorio_membros.csv',
    status: [['ativo', 'Ativos'], ['inativo', 'Inativos'], ['interessado', 'Interessados']],
  },
  {
    tipo: 'despesas',
    titulo: 'Relatório de Despesas',
    descricao: 'Despesas com categoria, campanha, valor, vencimento, pagamento e status. O período se aplica ao vencimento.',
    icone: Receipt,
    cor: '#dc2626',
    arquivo: 'relatorio_despesas.csv',
    status: [['pendente', 'Pendentes'], ['atrasado', 'Atrasadas'], ['pago', 'Pagas'], ['cancelado', 'Canceladas']],
    categorias: [
      ['administrativo', 'Administrativo'], ['recursos_humanos', 'Recursos Humanos'], ['projetos', 'Projetos'],
      ['captacao', 'Captação de Recursos'], ['outros', 'Outros'],
    ],
  },
]

export default function Relatorios() {
  const [estados, setEstados] = useState({})
  const [periodo, setPeriodo] = useState({ data_inicio: '', data_fim: '' })
  const [status, setStatus] = useState({})
  const [categoria, setCategoria] = useState('')
  const [formato, setFormato] = useState('imprimir')
  const navigate = useNavigate()

  function abrirPrestacaoContas() {
    const params = new URLSearchParams()
    if (periodo.data_inicio) params.set('data_inicio', periodo.data_inicio)
    if (periodo.data_fim) params.set('data_fim', periodo.data_fim)
    if (formato === 'csv') {
      handleDownload('despesas', 'relatorio_despesas.csv')
      return
    }
    navigate(`/admin/relatorios/prestacao-contas?${params}`)
  }

  async function handleDownload(tipo, arquivo) {
    setEstados((e) => ({ ...e, [tipo]: 'carregando' }))
    const params = {}
    if (periodo.data_inicio) params.data_inicio = periodo.data_inicio
    if (periodo.data_fim) params.data_fim = periodo.data_fim
    if (status[tipo]) params.status = status[tipo]
    if (tipo === 'despesas' && categoria) params.categoria = categoria
    try {
      const { data } = await downloadRelatorio(tipo, params)
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = arquivo
      a.click()
      URL.revokeObjectURL(url)
      setEstados((e) => ({ ...e, [tipo]: 'sucesso' }))
    } catch {
      setEstados((e) => ({ ...e, [tipo]: 'erro' }))
    }
    setTimeout(() => setEstados((e) => ({ ...e, [tipo]: null })), 3000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Relatórios</h1>
        <p className="text-xs text-[var(--text-muted)]">Exporte dados para prestação de contas e análises externas</p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-5 py-4 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-3">
        <CheckCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <p>
          Os relatórios são gerados em tempo real no formato <strong>CSV</strong> com separador
          <strong> ponto e vírgula</strong>, vírgula decimal e datas dd/mm/aaaa — abrem direto no Excel em
          português, no Google Planilhas e no LibreOffice Calc.
        </p>
      </div>

      <fieldset className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
        <legend className="sr-only">Período</legend>
        <p className="text-sm font-semibold text-[var(--text-primary)] mb-3">Período (opcional)</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            De
            <CampoData name="data_inicio" value={periodo.data_inicio} onChange={(e) => setPeriodo((p) => ({ ...p, data_inicio: e.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[var(--text-secondary)]">
            Até
            <CampoData name="data_fim" value={periodo.data_fim} onChange={(e) => setPeriodo((p) => ({ ...p, data_fim: e.target.value }))} />
          </label>
        </div>
      </fieldset>

      <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#16a34a22' }} aria-hidden="true">
            <Scale size={22} style={{ color: '#16a34a' }} />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">Prestação de contas</h3>
            <p className="text-sm text-[var(--text-secondary)]">Receitas por campanha, despesas por categoria, saldo e lista de despesas pagas no período escolhido acima (padrão: ano atual).</p>
          </div>
        </div>
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          Formato
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className="mt-1 block w-full md:w-56 text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)]">
            <option value="imprimir">Relatório para imprimir / PDF</option>
            <option value="csv">Planilha de despesas (CSV)</option>
          </select>
        </label>
        <button onClick={abrirPrestacaoContas} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: '#16a34a' }}>
          Gerar
        </button>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {RELATORIOS.map(({ tipo, titulo, descricao, icone: Icone, cor, arquivo, status: opcoes, categorias }) => {
          const estado = estados[tipo]
          const carregando = estado === 'carregando'
          return (
            <div key={tipo} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cor}22` }} aria-hidden="true">
                  <Icone size={22} style={{ color: cor }} />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] leading-snug">{titulo}</h3>
              </div>

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed flex-1">{descricao}</p>

              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Status
                <select
                  value={status[tipo] ?? ''}
                  onChange={(e) => setStatus((s) => ({ ...s, [tipo]: e.target.value }))}
                  className="mt-1 w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] outline-none focus:border-teal-500"
                >
                  <option value="">Todos</option>
                  {opcoes.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                </select>
              </label>

              {categorias && (
                <label className="text-xs font-medium text-[var(--text-secondary)]">
                  Categoria
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="mt-1 w-full text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-input)] text-[var(--text-primary)] outline-none focus:border-teal-500"
                  >
                    <option value="">Todas</option>
                    {categorias.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
                  </select>
                </label>
              )}

              {estado === 'erro' && (
                <div className="flex items-center gap-2 text-xs text-red-500" role="alert">
                  <AlertCircle size={13} aria-hidden="true" /> Erro ao gerar relatório. Tente novamente.
                </div>
              )}
              {estado === 'sucesso' && (
                <div className="flex items-center gap-2 text-xs text-emerald-600" role="status">
                  <CheckCircle size={13} aria-hidden="true" /> Download iniciado com sucesso!
                </div>
              )}

              <button
                onClick={() => handleDownload(tipo, arquivo)}
                disabled={carregando}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: cor }}
              >
                {carregando
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Download size={15} aria-hidden="true" />}
                {carregando ? 'Gerando...' : 'Baixar CSV'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
