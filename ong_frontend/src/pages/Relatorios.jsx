import { useState } from 'react'
import { Download, HandCoins, Megaphone, Users, CheckCircle, AlertCircle } from 'lucide-react'
import { downloadRelatorio } from '../services/api'

const RELATORIOS = [
  {
    tipo: 'doacoes',
    titulo: 'Relatório de Doações',
    descricao: 'Lista completa de todas as doações registradas com membro, campanha, valor, data e status.',
    icone: HandCoins,
    cor: '#0f4c5c',
    arquivo: 'relatorio_doacoes.csv',
  },
  {
    tipo: 'campanhas',
    titulo: 'Desempenho das Campanhas',
    descricao: 'Visão geral de todas as campanhas com metas, valores arrecadados, progresso e status.',
    icone: Megaphone,
    cor: '#f97316',
    arquivo: 'relatorio_campanhas.csv',
  },
  {
    tipo: 'apoiadores',
    titulo: 'Lista de Membros',
    descricao: 'Cadastro completo de membros com nome, e-mail, data de cadastro, status e total doado.',
    icone: Users,
    cor: '#0891b2',
    arquivo: 'relatorio_apoiadores.csv',
  },
]

export default function Relatorios() {
  const [estados, setEstados] = useState({})

  async function handleDownload(tipo, arquivo) {
    setEstados((e) => ({ ...e, [tipo]: 'carregando' }))
    try {
      const response = await downloadRelatorio(tipo)
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = arquivo
      a.click()
      URL.revokeObjectURL(url)
      setEstados((e) => ({ ...e, [tipo]: 'sucesso' }))
      setTimeout(() => setEstados((e) => ({ ...e, [tipo]: null })), 3000)
    } catch {
      setEstados((e) => ({ ...e, [tipo]: 'erro' }))
      setTimeout(() => setEstados((e) => ({ ...e, [tipo]: null })), 3000)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Relatórios</h1>
        <p className="text-xs text-[var(--text-muted)]">Exporte dados para prestação de contas e análises externas</p>
      </div>

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900 rounded-xl px-5 py-4 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <CheckCircle size={16} className="text-blue-400" />
        </div>
        <p>
          Os relatórios são gerados em tempo real e exportados no formato <strong>CSV</strong>,
          compatível com Excel, Google Planilhas e LibreOffice Calc.
          Abra o arquivo e ajuste o separador para <strong>vírgula</strong> se necessário.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {RELATORIOS.map(({ tipo, titulo, descricao, icone: Icone, cor, arquivo }) => {
          const estado = estados[tipo]
          const carregando = estado === 'carregando'
          const sucesso = estado === 'sucesso'
          const erro = estado === 'erro'

          return (
            <div key={tipo} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${cor}22` }}
                >
                  <Icone size={22} style={{ color: cor }} />
                </div>
                <h3 className="font-semibold text-[var(--text-primary)] leading-snug">{titulo}</h3>
              </div>

              <p className="text-sm text-[var(--text-secondary)] leading-relaxed flex-1">{descricao}</p>

              {erro && (
                <div className="flex items-center gap-2 text-xs text-red-500">
                  <AlertCircle size={13} />
                  Erro ao gerar relatório. Tente novamente.
                </div>
              )}

              {sucesso && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <CheckCircle size={13} />
                  Download iniciado com sucesso!
                </div>
              )}

              <button
                onClick={() => handleDownload(tipo, arquivo)}
                disabled={carregando}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: cor }}
              >
                {carregando ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                {carregando ? 'Gerando...' : 'Baixar CSV'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
