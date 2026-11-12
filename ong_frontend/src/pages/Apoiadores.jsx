import { useState } from 'react'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import BadgeStatus from '../components/BadgeStatus'
import TabelaVazia from '../components/TabelaVazia'
import Paginacao from '../components/Paginacao'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { formatBRL, formatCelular, formatData, mensagemErro } from '../utils/formatos'
import { getApoiadores, criarApoiador, atualizarApoiador, excluirApoiador } from '../services/api'

const VAZIO = { nome: '', email: '', celular: '', documento: '', status: 'ativo' }

function iniciais(nome) {
  return nome.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

export default function Apoiadores() {
  const { openDrawer } = useOutletContext() ?? {}
  const [filtroStatus, setFiltroStatus] = useState('')
  const lista = useListaPaginada(getApoiadores, { filtros: filtroStatus ? { status: filtroStatus } : {} })
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setModal(true)
  }

  function abrirEdicao(item) {
    setEditando(item)
    setForm({ nome: item.nome, email: item.email, celular: item.celular || '', documento: item.documento_formatado || '', status: item.status })
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
      if (editando) await atualizarApoiador(editando.id, form)
      else await criarApoiador(form)
      fechar()
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id, nome) {
    if (!confirm(`Excluir o membro "${nome}"?`)) return
    try {
      await excluirApoiador(id)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível excluir o membro.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Membros</h1>
          <p className="text-xs text-[var(--text-muted)]">Gerencie os membros da organização</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <UserPlus size={15} />
          Novo Membro
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por nome ou e-mail" />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          aria-label="Filtrar por status"
          className="text-sm border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--bg-card)] text-[var(--text-secondary)] outline-none focus:border-teal-500"
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativos</option>
          <option value="inativo">Inativos</option>
          <option value="interessado">Interessados (portal)</option>
        </select>
      </div>

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {lista.erro && <p className="text-red-500 text-sm p-4">{lista.erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <CabecalhoOrdenavel lista={lista} campo="nome" rotulo="Membro" />
                <CabecalhoOrdenavel lista={lista} campo="email" rotulo="E-mail" />
                <CabecalhoOrdenavel lista={lista} campo="celular" rotulo="Celular" />
                <CabecalhoOrdenavel lista={lista} campo="data_cadastro" rotulo="Cadastro" />
                <CabecalhoOrdenavel lista={lista} campo="total_doado" rotulo="Total Doado" alinhamento="right" />
                <CabecalhoOrdenavel lista={lista} campo="status" rotulo="Status" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={7} className="text-center py-10 text-[var(--text-muted)] text-sm">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : (
                lista.itens.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                    onClick={() => openDrawer?.({ type: 'apoiador', id: a.id })}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#0f4c5c' }}>
                          {iniciais(a.nome)}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{a.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{a.email}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{a.celular ? formatCelular(a.celular) : <span className="text-[var(--text-muted)]">—</span>}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(a.data_cadastro)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">{formatBRL(a.total_doado)}</td>
                    <td className="px-5 py-3"><BadgeStatus status={a.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                        <button onClick={() => abrirEdicao(a)} aria-label={`Editar ${a.nome}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-600 transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => onExcluir(a.id, a.nome)} aria-label={`Excluir ${a.nome}`} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
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
        <Modal titulo={editando ? 'Editar Membro' : 'Novo Membro'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Nome completo">
              <Input name="nome" value={form.nome} onChange={onChange} placeholder="Ex: Maria da Silva" required />
            </Campo>
            <Campo label="E-mail">
              <Input name="email" type="email" value={form.email} onChange={onChange} placeholder="maria@email.com" required />
            </Campo>
            <Campo label="Celular (opcional)">
              <Input name="celular" value={form.celular} onChange={onChange} placeholder="(11) 99999-9999" />
            </Campo>
            <Campo label="CPF ou CNPJ (opcional, aparece no recibo)">
              <Input name="documento" value={form.documento} onChange={onChange} placeholder="000.000.000-00" inputMode="numeric" maxLength={18} />
            </Campo>
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="interessado">Interessado</option>
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
