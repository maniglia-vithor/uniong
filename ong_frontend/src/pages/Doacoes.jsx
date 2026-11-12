import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import Paginacao from '../components/Paginacao'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { formatBRL, formatData, mensagemErro } from '../utils/formatos'
import {
  getDoacoes, getDoacoesResumo, criarDoacao, atualizarDoacao, excluirDoacao,
  getApoiadoresOpcoes, getCampanhasOpcoes,
} from '../services/api'

const VAZIO = { apoiador: '', campanha: '', valor: '', data: '', status: 'confirmada' }
const LIMITE_SEM_BUSCA = 50

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// Select com campo de busca quando a lista passa de ~50 itens.
function SelecaoComBusca({ name, value, onChange, opcoes, rotulo, vazio, required }) {
  const [filtro, setFiltro] = useState('')
  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase()
    if (!termo) return opcoes
    return opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo) || String(o.id) === String(value))
  }, [opcoes, filtro, value])
  return (
    <div className="space-y-1.5">
      {opcoes.length > LIMITE_SEM_BUSCA && (
        <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder={`Filtrar ${rotulo}...`} aria-label={`Filtrar ${rotulo}`} />
      )}
      <Select name={name} value={value} onChange={onChange} required={required}>
        <option value="">{vazio}</option>
        {visiveis.map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
      </Select>
    </div>
  )
}

export default function Doacoes() {
  const { openDrawer } = useOutletContext() ?? {}
  const [filtroStatus, setFiltroStatus] = useState('')
  const filtros = useMemo(() => (filtroStatus ? { status: filtroStatus } : {}), [filtroStatus])
  const lista = useListaPaginada(getDoacoes, { filtros })
  const [resumo, setResumo] = useState({ quantidade: 0, total_confirmado: 0 })
  const [apoiadores, setApoiadores] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  const { busca, itens } = lista
  useEffect(() => {
    const params = { ...filtros }
    if (busca.trim()) params.search = busca.trim()
    const t = setTimeout(() => {
      getDoacoesResumo(params).then(({ data }) => setResumo(data)).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [filtros, busca, itens])

  async function carregarOpcoes(item) {
    const [a, c] = await Promise.all([getApoiadoresOpcoes(), getCampanhasOpcoes()])
    const membros = a.data.map((m) => ({ id: m.id, rotulo: m.nome }))
    const camps = c.data.map((x) => ({ id: x.id, rotulo: x.titulo }))
    // Mantém selecionáveis o membro e a campanha atuais da doação editada, mesmo inativos/encerrados.
    if (item?.apoiador && !membros.some((m) => m.id === item.apoiador)) {
      membros.unshift({ id: item.apoiador, rotulo: item.apoiador_nome })
    }
    if (item?.campanha && !camps.some((x) => x.id === item.campanha)) {
      camps.unshift({ id: item.campanha, rotulo: `${item.campanha_titulo} (encerrada)` })
    }
    setApoiadores(membros)
    setCampanhas(camps)
  }

  async function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    await carregarOpcoes(null)
    setModal(true)
  }

  async function abrirEdicao(item) {
    setEditando(item)
    setForm({
      apoiador: item.apoiador,
      campanha: item.campanha || '',
      valor: item.valor,
      data: item.data,
      status: item.status,
    })
    await carregarOpcoes(item)
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null) }

  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const payload = { ...form, campanha: form.campanha || null }
    try {
      if (editando) await atualizarDoacao(editando.id, payload)
      else await criarDoacao(payload)
      fechar()
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id) {
    if (!confirm('Excluir esta doação?')) return
    try {
      await excluirDoacao(id)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível excluir a doação.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Doações</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {resumo.quantidade} registro{resumo.quantidade !== 1 ? 's' : ''} · Total confirmado:{' '}
            <span className="font-semibold" style={{ color: '#0f4c5c' }}>{formatBRL(resumo.total_confirmado)}</span>
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Registrar Doação
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por doador ou campanha" />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por status"
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-card)] text-[var(--text-secondary)] outline-none focus:border-teal-500"
        >
          <option value="">Todos os status</option>
          <option value="confirmada">Confirmadas</option>
          <option value="pendente">Pendentes</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      {lista.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{lista.erro}</div>
      )}

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <CabecalhoOrdenavel lista={lista} campo="apoiador__nome" rotulo="Doador" />
                <CabecalhoOrdenavel lista={lista} campo="campanha__titulo" rotulo="Campanha" />
                <CabecalhoOrdenavel lista={lista} campo="valor" rotulo="Valor" alinhamento="right" />
                <CabecalhoOrdenavel lista={lista} campo="data" rotulo="Data" />
                <CabecalhoOrdenavel lista={lista} campo="status" rotulo="Status" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : (
                lista.itens.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'doacao', id: d.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(d.apoiador_nome)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{d.apoiador_nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{d.campanha_titulo || <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">{formatBRL(d.valor)}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(d.data)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={d.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(d)} aria-label="Editar doação" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onExcluir(d.id)} aria-label="Excluir doação" className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </div>

      {modal && (
        <Modal titulo={editando ? 'Editar Doação' : 'Registrar Doação'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Membro">
              <SelecaoComBusca name="apoiador" value={form.apoiador} onChange={onChange} opcoes={apoiadores}
                rotulo="membros" vazio="Selecione um membro..." required />
            </Campo>
            <Campo label="Campanha (opcional)">
              <SelecaoComBusca name="campanha" value={form.campanha} onChange={onChange} opcoes={campanhas}
                rotulo="campanhas" vazio="Sem campanha vinculada" />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Valor (R$)">
                <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={onChange} placeholder="0,00" required />
              </Campo>
              <Campo label="Data">
                <CampoData name="data" value={form.data} onChange={onChange} required />
              </Campo>
            </div>
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="confirmada">Confirmada</option>
                <option value="pendente">Pendente</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Campo>
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={fechar} />
              <BotaoSubmit carregando={salvando} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
