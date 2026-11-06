import { useEffect, useState } from 'react'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import { getApoiadores, criarApoiador, atualizarApoiador, excluirApoiador } from '../services/api'

const VAZIO = { nome: '', email: '', status: 'ativo' }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Apoiadores() {
  const { openDrawer } = useOutletContext() ?? {}
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState(null)

  const carregar = () => {
    setCarregando(true)
    getApoiadores()
      .then((r) => setLista(r.data.results ?? r.data))
      .catch(() => setErro('Erro ao carregar apoiadores.'))
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
    setForm({ nome: item.nome, email: item.email, status: item.status })
    setModal(true)
  }

  function fechar() {
    setModal(false)
    setEditando(null)
  }

  function onChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editando) {
        await atualizarApoiador(editando.id, form)
      } else {
        await criarApoiador(form)
      }
      fechar()
      carregar()
    } catch {
      alert('Erro ao salvar. Verifique os dados e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id, nome) {
    if (!confirm(`Excluir o apoiador "${nome}"?`)) return
    try {
      await excluirApoiador(id)
      carregar()
    } catch {
      alert('Não é possível excluir: este apoiador possui doações vinculadas.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Apoiadores</h1>
          <p className="text-xs text-slate-400">Gerencie os apoiadores da organização</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <UserPlus size={15} />
          Novo Apoiador
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100">
        {erro && <p className="text-red-500 text-sm p-4">{erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Apoiador</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-slate-400 px-5 py-3">Cadastro</th>
                <th className="text-right text-xs font-medium text-slate-400 px-5 py-3">Total Doado</th>
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
                lista.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'apoiador', id: a.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(a.nome)}
                        </div>
                        <span className="font-medium text-slate-700">{a.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{a.email}</td>
                    <td className="px-5 py-3 text-slate-500">{a.data_cadastro}</td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-700">{formatBRL(a.total_doado)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={a.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(a)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-700 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onExcluir(a.id, a.nome)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
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
        <Modal titulo={editando ? 'Editar Apoiador' : 'Novo Apoiador'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Nome completo">
              <Input name="nome" value={form.nome} onChange={onChange} placeholder="Ex: Maria da Silva" required />
            </Campo>
            <Campo label="E-mail">
              <Input name="email" type="email" value={form.email} onChange={onChange} placeholder="maria@email.com" required />
            </Campo>
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
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
