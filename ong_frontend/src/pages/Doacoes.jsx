import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import { getDoacoes, criarDoacao, atualizarDoacao, excluirDoacao, getApoiadores, getCampanhas } from '../services/api'

const VAZIO = { apoiador: '', campanha: '', valor: '', data: '', status: 'confirmada' }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Doacoes() {
  const { openDrawer } = useOutletContext() ?? {}
  const [lista, setLista] = useState([])
  const [apoiadores, setApoiadores] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  const carregar = () => {
    setCarregando(true)
    setErro(null)
    Promise.all([getDoacoes(), getApoiadores(), getCampanhas()])
      .then(([d, a, c]) => {
        setLista(d.data.results ?? d.data)
        setApoiadores(a.data.results ?? a.data)
        setCampanhas(c.data.results ?? c.data)
      })
      .catch(() => setErro('Erro ao carregar dados. Verifique se o servidor está rodando.'))
      .finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setModal(true)
  }

  function abrirEdicao(item) {
    setEditando(item)
    setForm({
      apoiador: item.apoiador,
      campanha: item.campanha || '',
      valor: item.valor,
      data: item.data,
      status: item.status,
    })
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null) }

  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const payload = { ...form, campanha: form.campanha || null }
    try {
      if (editando) {
        await atualizarDoacao(editando.id, payload)
      } else {
        await criarDoacao(payload)
      }
      fechar()
      carregar()
    } catch {
      alert('Erro ao salvar. Verifique os dados.')
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id) {
    if (!confirm('Excluir esta doação?')) return
    await excluirDoacao(id)
    carregar()
  }

  const totalFiltrado = lista
    .filter((d) => d.status === 'confirmada')
    .reduce((acc, d) => acc + parseFloat(d.valor), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Doações</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {lista.length} registro{lista.length !== 1 ? 's' : ''} · Total confirmado:{' '}
            <span className="font-semibold" style={{ color: '#0f4c5c' }}>{formatBRL(totalFiltrado)}</span>
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

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{erro}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Doador</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Campanha</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Valor</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Data</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-300 text-sm">Carregando...</td></tr>
              ) : lista.length === 0 ? (
                <TabelaVazia />
              ) : (
                lista.map((d) => (
                  <tr
                    key={d.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'doacao', id: d.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(d.apoiador_nome)}
                        </div>
                        <span className="font-medium text-slate-700">{d.apoiador_nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{d.campanha_titulo || <span className="text-slate-300">—</span>}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatBRL(d.valor)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatData(d.data)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={d.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(d)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-700 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onExcluir(d.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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
      </div>

      {modal && (
        <Modal titulo={editando ? 'Editar Doação' : 'Registrar Doação'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Membro">
              <Select name="apoiador" value={form.apoiador} onChange={onChange} required>
                <option value="">Selecione um membro...</option>
                {apoiadores.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </Select>
            </Campo>
            <Campo label="Campanha (opcional)">
              <Select name="campanha" value={form.campanha} onChange={onChange}>
                <option value="">Sem campanha vinculada</option>
                {campanhas.map((c) => (
                  <option key={c.id} value={c.id}>{c.titulo}</option>
                ))}
              </Select>
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
