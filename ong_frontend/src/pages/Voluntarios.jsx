import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Users } from 'lucide-react'
import Modal from '../components/Modal'
import { Campo, Input, Select, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import CampoData from '../components/CampoData'
import Paginacao from '../components/Paginacao'
import TabelaVazia from '../components/TabelaVazia'
import { CabecalhoOrdenavel, CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { formatData, mensagemErro } from '../utils/formatos'
import {
  getVoluntarios, criarVoluntario, atualizarVoluntario, excluirVoluntario,
  getAtividades, criarAtividade, atualizarAtividade, excluirAtividade,
  getInscricoes, inscreverVoluntario, registrarHoras, cancelarInscricao, buscarTodas,
} from '../services/api'

const VOLUNTARIO_VAZIO = { nome: '', email: '', telefone: '', areas_interesse: '', disponibilidade: '', status: 'ativo' }
const ATIVIDADE_VAZIA = { titulo: '', data: '', local: '', descricao: '', vagas: 10 }
const textareaCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:border-teal-500 resize-none bg-[var(--bg-input)] text-[var(--text-primary)]'
const botaoIcone = 'p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors'

function horasFmt(h) {
  return `${Number(h || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} h`
}

function SituacaoVoluntario({ status }) {
  return status === 'ativo'
    ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ativo</span>
    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Inativo</span>
}

function AbaVoluntarios() {
  const lista = useListaPaginada(getVoluntarios, { ordenacaoInicial: 'nome' })
  const [form, setForm] = useState(null)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)

  function abrir(item) {
    setEditando(item)
    setForm(item ? Object.fromEntries(Object.keys(VOLUNTARIO_VAZIO).map((k) => [k, item[k] ?? ''])) : VOLUNTARIO_VAZIO)
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editando) await atualizarVoluntario(editando.id, form)
      else await criarVoluntario(form)
      setForm(null)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(v) {
    if (!confirm(`Excluir o voluntário ${v.nome}?`)) return
    try { await excluirVoluntario(v.id); lista.recarregar() } catch (err) { alert(mensagemErro(err)) }
  }

  const muda = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por nome, e-mail ou área" />
        <button onClick={() => abrir(null)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: '#0f4c5c' }}>
          <Plus size={15} aria-hidden="true" /> Novo voluntário
        </button>
      </div>
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {lista.erro && <p className="text-red-500 text-sm p-4">{lista.erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <CabecalhoOrdenavel lista={lista} campo="nome" rotulo="Nome" />
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Contato</th>
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Áreas de interesse</th>
                <CabecalhoOrdenavel lista={lista} campo="horas_total" rotulo="Horas" />
                <CabecalhoOrdenavel lista={lista} campo="status" rotulo="Situação" />
                <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : lista.itens.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-2.5 text-[var(--text-primary)] font-medium">{v.nome}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{[v.email, v.telefone].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{v.areas_interesse || '—'}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{horasFmt(v.horas_total)}</td>
                  <td className="px-5 py-2.5"><SituacaoVoluntario status={v.status} /></td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrir(v)} aria-label={`Editar ${v.nome}`} className={botaoIcone}><Pencil size={14} /></button>
                      <button onClick={() => excluir(v)} aria-label={`Excluir ${v.nome}`} className={botaoIcone}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </div>

      {form && (
        <Modal titulo={editando ? 'Editar voluntário' : 'Novo voluntário'} onFechar={() => setForm(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo label="Nome"><Input name="nome" value={form.nome} onChange={muda} required /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="E-mail (opcional)"><Input name="email" type="email" value={form.email} onChange={muda} /></Campo>
              <Campo label="Telefone (opcional)"><Input name="telefone" value={form.telefone} onChange={muda} placeholder="(11) 99999-9999" /></Campo>
            </div>
            <Campo label="Áreas de interesse"><Input name="areas_interesse" value={form.areas_interesse} onChange={muda} placeholder="Ex.: eventos, cozinha, aulas de reforço" /></Campo>
            <Campo label="Disponibilidade"><Input name="disponibilidade" value={form.disponibilidade} onChange={muda} placeholder="Ex.: sábados de manhã" /></Campo>
            <Campo label="Situação">
              <Select name="status" value={form.status} onChange={muda}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </Select>
            </Campo>
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={() => setForm(null)} />
              <BotaoSubmit carregando={salvando} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Inscricoes({ atividade, onAlterado }) {
  const [inscricoes, setInscricoes] = useState(null)
  const [voluntarios, setVoluntarios] = useState([])
  const [escolhido, setEscolhido] = useState('')
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    getInscricoes(atividade.id).then(({ data }) => setInscricoes(data)).catch(() => setInscricoes([]))
  }, [atividade.id, versao])

  useEffect(() => {
    buscarTodas('/voluntarios/', { status: 'ativo' }).then(setVoluntarios).catch(() => {})
  }, [])

  function recarregar() { setVersao((v) => v + 1); onAlterado() }

  async function inscrever(e) {
    e.preventDefault()
    try {
      await inscreverVoluntario(atividade.id, escolhido)
      setEscolhido('')
      recarregar()
    } catch (err) { alert(mensagemErro(err)) }
  }

  async function salvarHoras(inscricao, valor) {
    try {
      await registrarHoras(atividade.id, inscricao.id, valor === '' ? null : valor)
      recarregar()
    } catch (err) { alert(mensagemErro(err)) }
  }

  async function cancelar(inscricao) {
    if (!confirm(`Cancelar a inscrição de ${inscricao.voluntario_nome}?`)) return
    try { await cancelarInscricao(atividade.id, inscricao.id); recarregar() } catch (err) { alert(mensagemErro(err)) }
  }

  if (inscricoes === null) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
  const inscritosIds = new Set(inscricoes.map((i) => i.voluntario))
  const lotada = inscricoes.length >= atividade.vagas

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">{formatData(atividade.data)}{atividade.local && ` · ${atividade.local}`} · {inscricoes.length} de {atividade.vagas} vagas</p>
      {inscricoes.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Nenhum voluntário inscrito.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] border border-[var(--border)] rounded-lg">
          {inscricoes.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="text-[var(--text-primary)]">{i.voluntario_nome}</span>
              <div className="flex items-center gap-2">
                <label className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                  Horas
                  <input
                    type="number" min="0" max="24" step="0.5" defaultValue={i.horas ?? ''}
                    onBlur={(e) => { if (e.target.value !== String(i.horas ?? '')) salvarHoras(i, e.target.value) }}
                    className="w-20 px-2 py-1 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)]"
                  />
                </label>
                <button type="button" onClick={() => cancelar(i)} className="text-xs text-red-600 hover:underline">Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {lotada ? (
        <p className="text-xs text-amber-700">Todas as vagas estão preenchidas.</p>
      ) : (
        <form onSubmit={inscrever} className="flex gap-2">
          <select value={escolhido} onChange={(e) => setEscolhido(e.target.value)} required aria-label="Voluntário a inscrever"
            className="flex-1 px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)]">
            <option value="">Escolha um voluntário ativo...</option>
            {voluntarios.filter((v) => !inscritosIds.has(v.id)).map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </select>
          <button type="submit" className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#0f4c5c' }}>Inscrever</button>
        </form>
      )}
      <p className="text-[11px] text-[var(--text-muted)]">As horas são salvas ao sair do campo.</p>
    </div>
  )
}

function AbaAtividades() {
  const lista = useListaPaginada(getAtividades, { ordenacaoInicial: '-data' })
  const [form, setForm] = useState(null)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [gerindo, setGerindo] = useState(null)

  function abrir(item) {
    setEditando(item)
    setForm(item ? Object.fromEntries(Object.keys(ATIVIDADE_VAZIA).map((k) => [k, item[k] ?? ''])) : ATIVIDADE_VAZIA)
  }

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editando) await atualizarAtividade(editando.id, form)
      else await criarAtividade(form)
      setForm(null)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(a) {
    if (!confirm(`Excluir a atividade ${a.titulo}? As inscrições e horas registradas também serão apagadas.`)) return
    try { await excluirAtividade(a.id); lista.recarregar() } catch (err) { alert(mensagemErro(err)) }
  }

  const muda = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por título ou local" />
        <button onClick={() => abrir(null)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ backgroundColor: '#0f4c5c' }}>
          <Plus size={15} aria-hidden="true" /> Nova atividade
        </button>
      </div>
      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {lista.erro && <p className="text-red-500 text-sm p-4">{lista.erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <CabecalhoOrdenavel lista={lista} campo="data" rotulo="Data" />
                <CabecalhoOrdenavel lista={lista} campo="titulo" rotulo="Atividade" />
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Local</th>
                <CabecalhoOrdenavel lista={lista} campo="vagas" rotulo="Inscritos / vagas" />
                <th scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Horas</th>
                <th className="px-5 py-3"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : lista.itens.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{formatData(a.data)}</td>
                  <td className="px-5 py-2.5 text-[var(--text-primary)] font-medium">{a.titulo}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{a.local || '—'}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{a.inscritos} / {a.vagas}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{horasFmt(a.horas_total)}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setGerindo(a)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                        <Users size={12} aria-hidden="true" /> Inscrições e horas
                      </button>
                      <button onClick={() => abrir(a)} aria-label={`Editar ${a.titulo}`} className={botaoIcone}><Pencil size={14} /></button>
                      <button onClick={() => excluir(a)} aria-label={`Excluir ${a.titulo}`} className={botaoIcone}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </div>

      {form && (
        <Modal titulo={editando ? 'Editar atividade' : 'Nova atividade'} onFechar={() => setForm(null)}>
          <form onSubmit={salvar} className="space-y-4">
            <Campo label="Título"><Input name="titulo" value={form.titulo} onChange={muda} required /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data"><CampoData name="data" value={form.data} onChange={muda} required /></Campo>
              <Campo label="Vagas"><Input name="vagas" type="number" min="1" value={form.vagas} onChange={muda} required /></Campo>
            </div>
            <Campo label="Local (opcional)"><Input name="local" value={form.local} onChange={muda} /></Campo>
            <Campo label="Descrição (opcional)">
              <textarea name="descricao" value={form.descricao} onChange={muda} rows={3} className={textareaCls} />
            </Campo>
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={() => setForm(null)} />
              <BotaoSubmit carregando={salvando} />
            </div>
          </form>
        </Modal>
      )}

      {gerindo && (
        <Modal titulo={`Inscrições — ${gerindo.titulo}`} onFechar={() => setGerindo(null)}>
          <Inscricoes atividade={gerindo} onAlterado={lista.recarregar} />
        </Modal>
      )}
    </div>
  )
}

export default function Voluntarios() {
  const [aba, setAba] = useState('voluntarios')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-[var(--text-primary)]">Voluntários</h1>
        <p className="text-xs text-[var(--text-muted)]">Cadastro de voluntários, atividades, inscrições e horas de voluntariado</p>
      </div>
      <div role="tablist" aria-label="Seções de voluntariado" className="flex gap-1.5">
        {[['voluntarios', 'Voluntários'], ['atividades', 'Atividades']].map(([id, rotulo]) => (
          <button
            key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${aba === id ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
            style={aba === id ? { backgroundColor: '#0f4c5c' } : undefined}
          >
            {rotulo}
          </button>
        ))}
      </div>
      {aba === 'voluntarios' ? <AbaVoluntarios /> : <AbaAtividades />}
    </div>
  )
}
