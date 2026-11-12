import { useMemo, useState } from 'react'
import TabelaVazia from '../components/TabelaVazia'
import Paginacao from '../components/Paginacao'
import CampoData from '../components/CampoData'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { useAuth } from '../context/AuthContext'
import { getHistorico } from '../services/api'
import { NOMES_MODELOS, formatarMomento } from '../utils/formatos'

const selectCls = 'text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-card)] text-[var(--text-secondary)] outline-none focus:border-teal-500'

export default function Historico() {
  const { usuario } = useAuth()
  const [modelo, setModelo] = useState('')
  const [acao, setAcao] = useState('')
  const [periodo, setPeriodo] = useState({ data_inicio: '', data_fim: '' })
  const filtros = useMemo(() => {
    const f = {}
    if (modelo) f.modelo = modelo
    if (acao) f.acao = acao
    if (periodo.data_inicio) f.data_inicio = periodo.data_inicio
    if (periodo.data_fim) f.data_fim = periodo.data_fim
    return f
  }, [modelo, acao, periodo])
  const lista = useListaPaginada(getHistorico, { filtros })

  if (!usuario?.is_superuser) {
    return <p className="text-sm text-[var(--text-muted)]">Apenas superusuários podem consultar o histórico.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Histórico de alterações</h1>
        <p className="text-xs text-[var(--text-muted)]">Quem criou, alterou ou excluiu cada registro, com os valores antes e depois</p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar em campo ou valores" />
        <select value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Filtrar por tipo de registro" className={selectCls}>
          <option value="">Todos os registros</option>
          {Object.entries(NOMES_MODELOS).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
        <select value={acao} onChange={(e) => setAcao(e.target.value)} aria-label="Filtrar por ação" className={selectCls}>
          <option value="">Todas as ações</option>
          <option value="criacao">Criação</option>
          <option value="edicao">Edição</option>
          <option value="exclusao">Exclusão</option>
        </select>
        <label className="text-xs text-[var(--text-secondary)] w-36">De
          <CampoData name="data_inicio" value={periodo.data_inicio} onChange={(e) => setPeriodo((p) => ({ ...p, data_inicio: e.target.value }))} />
        </label>
        <label className="text-xs text-[var(--text-secondary)] w-36">Até
          <CampoData name="data_fim" value={periodo.data_fim} onChange={(e) => setPeriodo((p) => ({ ...p, data_fim: e.target.value }))} />
        </label>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {lista.erro && <p className="text-red-500 text-sm p-4">{lista.erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <CabecalhoOrdenavel lista={lista} campo="data" rotulo="Data" />
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Usuário</th>
                <CabecalhoOrdenavel lista={lista} campo="acao" rotulo="Ação" />
                <CabecalhoOrdenavel lista={lista} campo="modelo" rotulo="Registro" />
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Campo</th>
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Antes</th>
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Depois</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={7} className="text-center py-10 text-[var(--text-muted)]">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : lista.itens.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-5 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">{formatarMomento(l.data)}</td>
                  <td className="px-5 py-2.5 text-[var(--text-primary)]">{l.usuario_nome}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{l.acao_display}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{NOMES_MODELOS[l.modelo] ?? l.modelo} #{l.objeto_id}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{l.campo === '*' ? '—' : l.campo}</td>
                  <td className="px-5 py-2.5 text-[var(--text-muted)] max-w-[220px] break-words">{l.antes || '—'}</td>
                  <td className="px-5 py-2.5 text-[var(--text-primary)] max-w-[220px] break-words">{l.depois || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </div>
    </div>
  )
}
