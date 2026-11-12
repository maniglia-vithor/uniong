import { useState } from 'react'
import { Pencil, Trash2, Plus, ArrowUpDown } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import BadgeStatus from '../components/BadgeStatus'
import BarraProgresso from '../components/BarraProgresso'
import Paginacao from '../components/Paginacao'
import { CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { formatData, mensagemErro } from '../utils/formatos'
import { getCampanhas, criarCampanha, atualizarCampanha, excluirCampanha, encerrarCampanha, enviarImagemCampanha } from '../services/api'

const VAZIO = { titulo: '', meta_valor: '', status: 'ativa', data_inicio: '', data_fim: '', descricao: '' }

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export default function Campanhas() {
  const { openDrawer } = useOutletContext() ?? {}
  const lista = useListaPaginada(getCampanhas, { ordenacaoInicial: '-data_inicio' })
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [imagem, setImagem] = useState(null)

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

  function fechar() { setModal(false); setEditando(null); setImagem(null) }

  function onChange(e) { setForm((f) => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const payload = { ...form, data_fim: form.data_fim || null }
    try {
      const { data } = editando ? await atualizarCampanha(editando.id, payload) : await criarCampanha(payload)
      if (imagem) {
        try {
          await enviarImagemCampanha(data.id, imagem)
        } catch (err) {
          alert(`Campanha salva, mas a imagem não foi aceita: ${mensagemErro(err)}`)
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

  async function onExcluir(id, titulo) {
    if (!confirm(`Excluir a campanha "${titulo}"?`)) return
    try {
      await excluirCampanha(id)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível excluir a campanha.'))
    }
  }

  async function onEncerrar(campanha) {
    if (!confirm(`Encerrar a campanha "${campanha.titulo}"? Ela deixa de receber doações.`)) return
    try {
      await encerrarCampanha(campanha.id)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível encerrar a campanha.'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Campanhas</h1>
          <p className="text-xs text-[var(--text-muted)]">Gerencie as campanhas de arrecadação</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <ArrowUpDown size={13} />
            <select
              value={lista.ordenacao}
              onChange={e => lista.setOrdenacao(e.target.value)}
              aria-label="Ordenar campanhas"
              className="text-xs border border-[var(--border)] rounded-lg px-2 py-1.5 bg-[var(--bg-card)] text-[var(--text-secondary)] outline-none focus:border-teal-500 cursor-pointer"
            >
              <option value="-data_inicio">Mais recentes</option>
              <option value="data_inicio">Mais antigas</option>
              <option value="titulo">Título A→Z</option>
              <option value="-titulo">Título Z→A</option>
              <option value="-meta_valor">Maior meta</option>
              <option value="meta_valor">Menor meta</option>
              <option value="-progresso">Maior progresso</option>
              <option value="progresso">Menor progresso</option>
            </select>
          </div>
          <button
            onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#0f4c5c' }}
          >
            <Plus size={15} /> Nova Campanha
          </button>
        </div>
      </div>

      <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por título" />

      {lista.erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center text-red-600 text-sm">{lista.erro}</div>
      )}

      {lista.carregando ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
        </div>
      ) : !lista.erro && (<>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.itens.map((c, i) => (
            <div
              key={c.id}
              className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)] p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openDrawer?.({ type: 'campanha', id: c.id })}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-[var(--text-primary)] leading-snug">{c.titulo}</h3>
                <BadgeStatus status={c.status_efetivo ?? c.status} />
              </div>

              <div>
                <div className="flex justify-between mb-1.5 text-xs text-[var(--text-secondary)]">
                  <span>{formatBRL(c.valor_arrecadado)} arrecadados</span>
                  <span className="font-semibold" style={{ color: i % 2 === 0 ? 'var(--marca-texto)' : 'var(--destaque-texto)' }}>
                    {c.percentual_progresso}%
                  </span>
                </div>
                <BarraProgresso percentual={c.percentual_progresso} cor={i % 2 === 0 ? '#0f4c5c' : '#f97316'} />
                <p className="text-xs text-[var(--text-muted)] mt-1">Meta: {formatBRL(c.meta_valor)}</p>
              </div>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">Início: {formatData(c.data_inicio)}</span>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {c.status !== 'encerrada' && (
                    <button
                      onClick={() => onEncerrar(c)}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Encerrar campanha
                    </button>
                  )}
                  <button onClick={() => abrirEdicao(c)} aria-label={`Editar ${c.titulo}`} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-teal-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onExcluir(c.id, c.titulo)} aria-label={`Excluir ${c.titulo}`} className="p-1.5 rounded-lg hover:bg-red-50 text-[var(--text-muted)] hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {lista.itens.length === 0 && (
            <p className="col-span-3 text-center py-16 text-[var(--text-muted)] text-sm">Nenhuma campanha encontrada.</p>
          )}
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </>)}

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
                className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </Campo>
            <Campo label="Imagem pública (opcional)">
              {editando?.imagem_url && !imagem && (
                <img src={editando.imagem_url} alt="Imagem atual da campanha" className="w-full h-28 object-cover rounded-lg mb-2" />
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(e) => setImagem(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-[var(--text-secondary)]"
              />
              <p className="text-[11px] text-[var(--text-muted)] mt-1">JPG, PNG ou WEBP até 5 MB. Aparece no portal e na prévia ao compartilhar.</p>
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
