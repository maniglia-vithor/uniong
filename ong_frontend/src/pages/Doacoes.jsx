import { useEffect, useMemo, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import Paginacao from '../components/Paginacao'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { FORMAS_PAGAMENTO, formatBRL, formatData, mensagemErro } from '../utils/formatos'
import {
  getDoacoes, getDoacoesResumo, criarDoacao, atualizarDoacao, excluirDoacao,
  getApoiadoresOpcoes, getCampanhasOpcoes, acaoEmLoteDoacoes, enviarComprovanteDoacao,
} from '../services/api'

const VAZIO = {
  apoiador: '', anonima: false, campanha: '', tipo: 'financeira', valor: '', descricao_bens: '', valor_estimado: '',
  data: '', status: 'confirmada', forma_pagamento: 'pix', observacao: '',
}
const LIMITE_SEM_BUSCA = 50
const ABAS_STATUS = [['', 'Todas'], ['pendente', 'Pendentes'], ['confirmada', 'Confirmadas'], ['cancelada', 'Canceladas']]

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// Select com campo de busca quando a lista passa de ~50 itens.
function SelecaoComBusca({ name, value, onChange, opcoes, rotulo, vazio, required, id, 'aria-describedby': descritoPor }) {
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
      <Select id={id} aria-describedby={descritoPor} name={name} value={value} onChange={onChange} required={required}>
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
  const [resumo, setResumo] = useState({ quantidade: 0, total_confirmado: 0, bens_quantidade: 0, bens_valor_estimado: 0 })
  const [comprovante, setComprovante] = useState(null)
  const [pendentes, setPendentes] = useState(0)
  const [selecionadas, setSelecionadas] = useState([])
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
      getDoacoesResumo({ status: 'pendente' }).then(({ data }) => setPendentes(data.quantidade)).catch(() => {})
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
      apoiador: item.apoiador ?? '',
      anonima: item.anonima,
      campanha: item.campanha || '',
      tipo: item.tipo,
      valor: item.tipo === 'bens' ? '' : item.valor,
      descricao_bens: item.descricao_bens || '',
      valor_estimado: item.valor_estimado ?? '',
      data: item.data,
      status: item.status,
      forma_pagamento: item.forma_pagamento || 'pix',
      observacao: item.observacao || '',
    })
    await carregarOpcoes(item)
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null); setComprovante(null) }

  function onChange(e) {
    const { name, type, checked, value } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const { anonima, ...resto } = form
    const payload = {
      ...resto,
      apoiador: anonima ? null : form.apoiador,
      campanha: form.campanha || null,
      valor_estimado: form.valor_estimado === '' ? null : form.valor_estimado,
    }
    if (form.tipo === 'bens') delete payload.valor
    try {
      const { data } = editando ? await atualizarDoacao(editando.id, payload) : await criarDoacao(payload)
      if (comprovante) {
        try {
          await enviarComprovanteDoacao(data.id, comprovante)
        } catch (err) {
          alert(`Doação salva, mas o comprovante não foi aceito: ${mensagemErro(err)}`)
        }
      }
      fechar()
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function agirEmLote(acao, ids) {
    const texto = acao === 'confirmar' ? 'Confirmar' : 'Cancelar'
    if (ids.length > 1 && !confirm(`${texto} ${ids.length} doações pendentes?`)) return
    try {
      await acaoEmLoteDoacoes(ids, acao)
      setSelecionadas([])
      lista.recarregar()
      window.dispatchEvent(new Event('doacoes-pendentes-alteradas'))
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível atualizar as doações.'))
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
            <span className="font-semibold" style={{ color: 'var(--marca-texto)' }}>{formatBRL(resumo.total_confirmado)}</span>
            {resumo.bens_quantidade > 0 && (
              <> · Em bens: {resumo.bens_quantidade} doaç{resumo.bens_quantidade !== 1 ? 'ões' : 'ão'}
                {resumo.bens_valor_estimado > 0 && <> (estimado {formatBRL(resumo.bens_valor_estimado)}, fora dos totais)</>}
              </>
            )}
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

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div role="tablist" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
          {ABAS_STATUS.map(([valor, rotulo]) => {
            const ativa = filtroStatus === valor
            const destaque = valor === 'pendente' && pendentes > 0
            return (
              <button
                key={valor || 'todas'}
                role="tab"
                aria-selected={ativa}
                onClick={() => { setFiltroStatus(valor); setSelecionadas([]) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  ativa
                    ? 'text-white border-transparent'
                    : destaque
                      ? 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
                style={ativa ? { backgroundColor: '#0f4c5c' } : undefined}
              >
                {rotulo}
                {valor === 'pendente' && pendentes > 0 && (
                  <span className={`min-w-[18px] px-1 rounded-full text-[10px] ${ativa ? 'bg-white/25' : 'bg-amber-500 text-white'}`}>{pendentes}</span>
                )}
              </button>
            )
          })}
        </div>
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por doador, campanha ou itens" />
      </div>

      {filtroStatus === 'pendente' && selecionadas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm">
          <span className="text-[var(--text-secondary)]">{selecionadas.length} selecionada{selecionadas.length !== 1 ? 's' : ''}</span>
          <button onClick={() => agirEmLote('confirmar', selecionadas)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700">
            Confirmar selecionadas
          </button>
          <button onClick={() => agirEmLote('cancelar', selecionadas)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            Cancelar selecionadas
          </button>
        </div>
      )}

      {lista.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{lista.erro}</div>
      )}

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {filtroStatus === 'pendente' && (
                  <th className="pl-5 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todas as pendentes da página"
                      checked={lista.itens.length > 0 && lista.itens.every((d) => selecionadas.includes(d.id))}
                      onChange={(e) => setSelecionadas(e.target.checked ? lista.itens.map((d) => d.id) : [])}
                    />
                  </th>
                )}
                <CabecalhoOrdenavel lista={lista} campo="apoiador__nome" rotulo="Doador" />
                <CabecalhoOrdenavel lista={lista} campo="campanha__titulo" rotulo="Campanha" />
                <CabecalhoOrdenavel lista={lista} campo="valor" rotulo="Valor" alinhamento="right" />
                <CabecalhoOrdenavel lista={lista} campo="data" rotulo="Data" />
                <CabecalhoOrdenavel lista={lista} campo="status" rotulo="Status" />
                <th scope="col" className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={filtroStatus === 'pendente' ? 7 : 6} className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : (
                lista.itens.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'doacao', id: d.id })}
                  >
                    {filtroStatus === 'pendente' && (
                      <td className="pl-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar doação de ${d.apoiador_nome}`}
                          checked={selecionadas.includes(d.id)}
                          onChange={(e) => setSelecionadas((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))}
                        />
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(d.apoiador_nome)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{d.apoiador_nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{d.campanha_titulo || <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">
                      {d.tipo === 'bens' ? (
                        <span title={d.descricao_bens} className="text-xs font-medium text-[var(--text-secondary)]">
                          Bens{d.valor_estimado ? ` (≈ ${formatBRL(d.valor_estimado)})` : ''}
                        </span>
                      ) : (
                        <>
                          {formatBRL(d.valor)}
                          <span className="block text-[10px] font-normal text-[var(--text-muted)]">{d.forma_pagamento_display}</span>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(d.data)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={d.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        {d.status === 'pendente' && (
                          <>
                            <button onClick={() => agirEmLote('confirmar', [d.id])} className="px-2 py-1 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700">
                              Confirmar
                            </button>
                            <button onClick={() => agirEmLote('cancelar', [d.id])} className="px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                              Cancelar
                            </button>
                          </>
                        )}
                        {d.status === 'confirmada' && (
                          <Link to={`/admin/doacoes/${d.id}/recibo`} title={d.recibo_numero ? `Recibo nº ${d.recibo_numero}` : 'Gerar recibo'}
                            className="px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] whitespace-nowrap">
                            {d.recibo_numero ? 'Ver recibo' : 'Gerar recibo'}
                          </Link>
                        )}
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
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" name="anonima" checked={form.anonima} onChange={onChange} />
              Doação anônima (sem membro vinculado)
            </label>
            {!form.anonima && (
              <Campo label="Membro">
                <SelecaoComBusca name="apoiador" value={form.apoiador} onChange={onChange} opcoes={apoiadores}
                  rotulo="membros" vazio="Selecione um membro..." required />
              </Campo>
            )}
            <Campo label="Tipo">
              <Select name="tipo" value={form.tipo} onChange={onChange}>
                <option value="financeira">Financeira (dinheiro)</option>
                <option value="bens">Bens / em espécie (alimentos, roupas, materiais...)</option>
              </Select>
            </Campo>
            <Campo label="Campanha (opcional)">
              <SelecaoComBusca name="campanha" value={form.campanha} onChange={onChange} opcoes={campanhas}
                rotulo="campanhas" vazio="Sem campanha vinculada" />
            </Campo>
            {form.tipo === 'bens' ? (
              <>
                <Campo label="Itens doados">
                  <textarea
                    name="descricao_bens" value={form.descricao_bens} onChange={onChange} rows={2} required
                    placeholder="Ex.: 20 cestas básicas e 15 kg de roupas"
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:border-teal-500 resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
                  />
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Valor estimado (R$, opcional)">
                    <Input name="valor_estimado" type="number" min="0" step="0.01" value={form.valor_estimado} onChange={onChange} placeholder="0,00" />
                  </Campo>
                  <Campo label="Data">
                    <CampoData name="data" value={form.data} onChange={onChange} required />
                  </Campo>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] -mt-2">Doações em bens não entram nos totais financeiros; aparecem em indicador e relatório próprios.</p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Valor (R$)">
                    <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor} onChange={onChange} placeholder="0,00" required />
                  </Campo>
                  <Campo label="Data">
                    <CampoData name="data" value={form.data} onChange={onChange} required />
                  </Campo>
                </div>
                <Campo label="Forma de pagamento">
                  <Select name="forma_pagamento" value={form.forma_pagamento} onChange={onChange}>
                    {FORMAS_PAGAMENTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </Select>
                </Campo>
              </>
            )}
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="confirmada">Confirmada</option>
                <option value="pendente">Pendente</option>
                <option value="cancelada">Cancelada</option>
              </Select>
            </Campo>
            <Campo label="Observação (opcional)">
              <textarea
                name="observacao" value={form.observacao} onChange={onChange} rows={2}
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:border-teal-500 resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </Campo>
            <Campo label={editando?.tem_comprovante ? `Comprovante (atual: ${editando.comprovante_nome}; envie outro para substituir)` : 'Comprovante (opcional)'}>
              <input
                type="file" accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setComprovante(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-[var(--text-secondary)]"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">PDF, JPG, PNG ou WEBP até 5 MB. Fica visível só para a equipe.</p>
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
