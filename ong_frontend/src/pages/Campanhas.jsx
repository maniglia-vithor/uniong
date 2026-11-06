import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import BarraProgresso from '../components/BarraProgresso'
import { getCampanhas, criarCampanha, atualizarCampanha, excluirCampanha } from '../services/api'

const VAZIO = { titulo: '', meta_valor: '', status: 'ativa', data_inicio: '', data_fim: '', descricao: '' }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function Campanhas() {
  const { openDrawer } = useOutletContext() ?? {}
  const [lista, setLista] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)

  const carregar = () => {
    setCarregando(true)
    setErro(null)
    getCampanhas()
      .then((r) => setLista(r.data.results ?? r.data))
      .catch(() => setErro('Erro ao carregar campanhas. Verifique se o servidor está rodando.'))
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
      titulo: item.titulo,
      meta_valor: item.meta_valor,
      status: item.status,
      data_inicio: item.data_inicio,
      data_fim: item.data_fim || '',
      descricao: item.descricao || '',
    })
    setModal(true)
  }

  function fechar() { setModal(false); setEditando(null) }

  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const payload = { ...form, data_fim: form.data_fim || null }
    try {
      if (editando) {
        await atualizarCampanha(editando.id, payload)
      } else {
        await criarCampanha(payload)
      }
      fechar()
      carregar()
    } catch {
      alert('Erro ao salvar. Verifique os dados.')
    } finally {
      setSalvando(false)
    }
  }

  async function onExcluir(id, titulo) {
    if (!confirm(`Excluir a campanha "${titulo}"?`)) return
    try {
      await excluirCampanha(id)
      carregar()
    } catch {
      alert('Não é possível excluir: existem doações vinculadas a esta campanha.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Campanhas</h1>
          <p className="text-xs text-slate-400">Gerencie as campanhas de arrecadação</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <Plus size={15} /> Nova Campanha
        </button>
      </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{erro}</div>
      )}

      {carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
        </div>
      ) : !erro && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((c, i) => (
            <div
              key={c.id}
              className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDrawer?.({ type: 'campanha', id: c.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 leading-snug">{c.titulo}</h3>
                <BadgeStatus status={c.status} />
              </div>

              <div>
                <div className="flex justify-between mb-1.5 text-xs text-slate-500">
                  <span>{formatBRL(c.valor_arrecadado)} arrecadados</span>
                  <span className="font-semibold" style={{ color: i % 2 === 0 ? '#0f4c5c' : '#f97316' }}>
                    {c.percentual_progresso}%
                  </span>
                </div>
                <BarraProgresso percentual={c.percentual_progresso} cor={i % 2 === 0 ? '#0f4c5c' : '#f97316'} />
                <p className="text-xs text-slate-400 mt-1">Meta: {formatBRL(c.meta_valor)}</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                <span className="text-xs text-slate-400">Início: {c.data_inicio}</span>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => abrirEdicao(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-teal-700 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onExcluir(c.id, c.titulo)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {lista.length === 0 && (
            <p className="col-span-3 text-center py-16 text-slate-400 text-sm">Nenhuma campanha cadastrada.</p>
          )}
        </div>
      )}

      {modal && (
        <Modal titulo={editando ? 'Editar Campanha' : 'Nova Campanha'} onFechar={fechar}>
          <form onSubmit={onSubmit} className="space-y-4">
            <Campo label="Título">
              <Input name="titulo" value={form.titulo} onChange={onChange} placeholder="Ex: Alimentação Solidária" required />
            </Campo>
            <Campo label="Meta de arrecadação (R$)">
              <Input name="meta_valor" type="number" min="1" step="0.01" value={form.meta_valor} onChange={onChange} placeholder="0,00" required />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data de início">
                <CampoData name="data_inicio" value={form.data_inicio} onChange={onChange} required />
              </Campo>
              <Campo label="Data de encerramento">
                <CampoData name="data_fim" value={form.data_fim} onChange={onChange} />
              </Campo>
            </div>
            <Campo label="Status">
              <Select name="status" value={form.status} onChange={onChange}>
                <option value="ativa">Ativa</option>
                <option value="pausada">Pausada</option>
                <option value="encerrada">Encerrada</option>
              </Select>
            </Campo>
            <Campo label="Descrição (opcional)">
              <textarea
                name="descricao"
                value={form.descricao}
                onChange={onChange}
                rows={3}
                placeholder="Descreva o objetivo desta campanha..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none"
              />
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
