import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Pencil, Save, XCircle } from 'lucide-react'
import api, { anonimizarApoiador, exportarDadosApoiador, baixarComprovanteDoacao, getContribuicoes, criarContribuicao, atualizarContribuicao, excluirContribuicao } from '../services/api'
import BadgeStatus from './BadgeStatus'
import BarraProgresso from './BarraProgresso'
import { Campo, Input, Select } from './CampoForm'
import CampoData from './CampoData'
import { useAuth } from '../context/AuthContext'
import { FORMAS_PAGAMENTO, formatarMomento, mensagemErro } from '../utils/formatos'

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}
function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function iniciais(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

async function baixarDoComprovante(record) {
  try {
    const { data } = await baixarComprovanteDoacao(record.id)
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = record.comprovante_nome || 'comprovante'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    alert(mensagemErro(err, 'Não foi possível baixar o comprovante.'))
  }
}

// ── Detalhe Doação ──────────────────────────────────────────
function DetalheDoacao({ record, onEdit }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#0f4c5c' }}>
          {iniciais(record.apoiador_nome)}
        </div>
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-base">{record.apoiador_nome}</p>
          <p className="text-xs text-[var(--text-muted)]">Doador</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {record.tipo === 'bens' ? (
          <InfoBox label="Valor estimado" value={record.valor_estimado ? formatBRL(record.valor_estimado) : 'Não informado'} destaque />
        ) : (
          <InfoBox label="Valor" value={formatBRL(record.valor)} destaque />
        )}
        <InfoBox label="Data" value={formatData(record.data)} />
        <InfoBox label="Status" value={<BadgeStatus status={record.status} />} />
        <InfoBox label="Campanha" value={record.campanha_titulo || '—'} />
        <InfoBox label="Tipo" value={record.tipo === 'bens' ? 'Bens / em espécie' : 'Financeira'} />
        {record.tipo !== 'bens' && <InfoBox label="Forma de pagamento" value={record.forma_pagamento_display || '—'} />}
      </div>
      {record.tipo === 'bens' && <InfoBox label="Itens doados" value={record.descricao_bens} />}
      {record.observacao && <InfoBox label="Observação" value={record.observacao} />}
      {record.status === 'confirmada' && (
        <a href={`/admin/doacoes/${record.id}/recibo`} className="block text-xs font-semibold underline" style={{ color: '#0f4c5c' }}>
          {record.recibo_numero ? `Ver recibo nº ${record.recibo_numero}` : 'Gerar recibo'}
        </a>
      )}
      {record.tem_comprovante && (
        <button type="button" onClick={() => baixarDoComprovante(record)}
          className="text-xs font-semibold underline" style={{ color: '#0f4c5c' }}>
          Baixar comprovante ({record.comprovante_nome})
        </button>
      )}
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Doação
      </button>
    </div>
  )
}

function EditDoacao({ record, apoiadores, campanhas, onSaved, onCancel }) {
  const [form, setForm] = useState({
    apoiador: record.apoiador ?? '',
    anonima: record.anonima,
    campanha: record.campanha || '',
    valor: record.valor,
    data: record.data,
    status: record.status,
  })
  const [salvando, setSalvando] = useState(false)
  const bens = record.tipo === 'bens'

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    const { anonima, ...resto } = form
    const payload = { ...resto, apoiador: anonima ? null : form.apoiador, campanha: form.campanha || null }
    if (bens) delete payload.valor
    try {
      await api.patch(`/doacoes/${record.id}/`, payload)
      onSaved()
    } catch (err) { alert(mensagemErro(err, 'Erro ao salvar.')) }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <input type="checkbox" checked={form.anonima} onChange={e => setForm(f => ({ ...f, anonima: e.target.checked }))} />
        Doação anônima
      </label>
      {!form.anonima && (
        <Campo label="Membro">
          <Select name="apoiador" value={form.apoiador} onChange={e => setForm(f => ({ ...f, apoiador: e.target.value }))} required>
            <option value="">Selecione...</option>
            {apoiadores.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
        </Campo>
      )}
      <Campo label="Campanha (opcional)">
        <Select name="campanha" value={form.campanha} onChange={e => setForm(f => ({ ...f, campanha: e.target.value }))}>
          <option value="">Sem campanha</option>
          {campanhas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        {!bens && (
          <Campo label="Valor (R$)">
            <Input name="valor" type="number" min="0.01" step="0.01" value={form.valor}
              onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} required />
          </Campo>
        )}
        <Campo label="Data">
          <CampoData name="data" value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
        </Campo>
      </div>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="confirmada">Confirmada</option>
          <option value="pendente">Pendente</option>
          <option value="cancelada">Cancelada</option>
        </Select>
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe Campanha ────────────────────────────────────────
function DespesasDaCampanha({ id }) {
  const [despesas, setDespesas] = useState(null)
  useEffect(() => {
    api.get(`/campanhas/${id}/despesas/`).then((r) => setDespesas(r.data)).catch(() => setDespesas([]))
  }, [id])
  if (despesas === null) return <p className="text-xs text-[var(--text-muted)]">Carregando despesas…</p>
  if (despesas.length === 0) return <p className="text-xs text-[var(--text-muted)]">Nenhuma despesa paga vinculada.</p>
  return (
    <ul className="divide-y divide-[var(--border-subtle)] border border-[var(--border)] rounded-lg">
      {despesas.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="truncate text-[var(--text-primary)]">{d.descricao}</span>
          <span className="flex-shrink-0 text-[var(--text-secondary)]">{formatBRL(d.valor)} · {formatData(d.data_pagamento)}</span>
        </li>
      ))}
    </ul>
  )
}

function DetalheCampanha({ record, onEdit }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-[var(--text-primary)] text-base">{record.titulo}</h3>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{record.descricao || 'Sem descrição.'}</p>
      </div>
      <div>
        <div className="flex justify-between mb-1.5 text-xs text-[var(--text-secondary)]">
          <span>{formatBRL(record.valor_arrecadado)} arrecadados</span>
          <span className="font-semibold" style={{ color: '#f97316' }}>{record.percentual_progresso}%</span>
        </div>
        <BarraProgresso percentual={record.percentual_progresso} cor="#f97316" />
        <p className="text-xs text-[var(--text-muted)] mt-1">Meta: {formatBRL(record.meta_valor)}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Arrecadado" value={formatBRL(record.valor_arrecadado)} destaque />
        <InfoBox label="Gasto" value={formatBRL(record.valor_gasto)} />
        <InfoBox label="Saldo da campanha" value={formatBRL(record.saldo)} destaque />
        <InfoBox label="Status" value={<BadgeStatus status={record.status_efetivo ?? record.status} />} />
        <InfoBox label="Início" value={formatData(record.data_inicio)} />
        <InfoBox label="Encerramento" value={formatData(record.data_fim)} />
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Despesas pagas da campanha</p>
        <DespesasDaCampanha id={record.id} />
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Campanha
      </button>
    </div>
  )
}

function EditCampanha({ record, onSaved, onCancel }) {
  const [form, setForm] = useState({
    titulo: record.titulo,
    meta_valor: record.meta_valor,
    status: record.status,
    data_inicio: record.data_inicio,
    data_fim: record.data_fim || '',
    descricao: record.descricao || '',
  })
  const [salvando, setSalvando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put(`/campanhas/${record.id}/`, { ...form, data_fim: form.data_fim || null })
      onSaved()
    } catch { alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Título">
        <Input name="titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} required />
      </Campo>
      <Campo label="Meta (R$)">
        <Input name="meta_valor" type="number" min="1" step="0.01" value={form.meta_valor}
          onChange={e => setForm(f => ({ ...f, meta_valor: e.target.value }))} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Data de início">
          <CampoData name="data_inicio" value={form.data_inicio}
            onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} required />
        </Campo>
        <Campo label="Encerramento">
          <CampoData name="data_fim" value={form.data_fim}
            onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
        </Campo>
      </div>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="ativa">Ativa</option>
          <option value="pausada">Pausada</option>
          <option value="encerrada">Encerrada</option>
        </Select>
      </Campo>
      <Campo label="Descrição">
        <textarea name="descricao" value={form.descricao}
          onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
          rows={3} className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-primary)] rounded-lg outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 resize-none" />
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe Apoiador ────────────────────────────────────────
function DetalheApoiador({ record, onEdit, onAlterado }) {
  const { usuario } = useAuth()

  async function exportar() {
    try {
      const { data } = await exportarDadosApoiador(record.id)
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `dados_membro_${record.id}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível exportar os dados.'))
    }
  }

  async function anonimizar() {
    const aviso = `Anonimizar ${record.nome}?\n\nNome, e-mail, celular e CPF/CNPJ serão substituídos por valores neutros, ` +
      'inclusive no histórico. As doações continuam registradas, sem identificação. Esta ação não pode ser desfeita.'
    if (!confirm(aviso)) return
    try {
      await anonimizarApoiador(record.id)
      onAlterado?.()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível anonimizar o membro.'))
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
          style={{ backgroundColor: '#3b82f6' }}>
          {iniciais(record.nome)}
        </div>
        <div>
          <p className="font-semibold text-[var(--text-primary)] text-base">{record.nome}</p>
          <p className="text-xs text-[var(--text-muted)]">{record.email}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Status" value={<BadgeStatus status={record.status} />} />
        <InfoBox label="Cadastro" value={formatData(record.data_cadastro)} />
        <InfoBox label="Total doado" value={formatBRL(record.total_doado)} destaque />
      </div>
      <button onClick={onEdit}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} /> Editar Membro
      </button>
      <ContribuicoesDoMembro apoiadorId={record.id} />
      <section className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dados pessoais (LGPD)</h3>
        {record.anonimizado_em ? (
          <p className="text-xs text-[var(--text-muted)]">Dados anonimizados em {formatarMomento(record.anonimizado_em)}.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportar} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
              Exportar dados (JSON)
            </button>
            {usuario?.is_superuser && (
              <button type="button" onClick={anonimizar} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 text-red-700 hover:bg-red-50">
                Anonimizar membro
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

const CONTRIBUICAO_VAZIA = { valor: '', periodicidade: 'mensal', dia_vencimento: 10, data_inicio: '', forma_pagamento: 'pix' }

function ContribuicoesDoMembro({ apoiadorId }) {
  const [itens, setItens] = useState(null)
  const [form, setForm] = useState(null)
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    getContribuicoes({ apoiador: apoiadorId, page_size: 100 })
      .then(({ data }) => setItens(data.results ?? data))
      .catch(() => setItens([]))
  }, [apoiadorId, versao])

  async function salvar(e) {
    e.preventDefault()
    try {
      await criarContribuicao({ ...form, apoiador: apoiadorId })
      setForm(null)
      setVersao(v => v + 1)
    } catch (err) { alert(mensagemErro(err)) }
  }

  async function alternar(c) {
    try {
      await atualizarContribuicao(c.id, { ativa: !c.ativa })
      setVersao(v => v + 1)
    } catch (err) { alert(mensagemErro(err)) }
  }

  async function excluir(c) {
    if (!confirm('Excluir esta contribuição? As doações já geradas são mantidas.')) return
    try {
      await excluirContribuicao(c.id)
      setVersao(v => v + 1)
    } catch (err) { alert(mensagemErro(err)) }
  }

  const muda = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  return (
    <section className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Contribuições periódicas</h3>
        {!form && (
          <button type="button" onClick={() => setForm(CONTRIBUICAO_VAZIA)} className="text-xs font-semibold" style={{ color: '#0f4c5c' }}>
            + Nova contribuição
          </button>
        )}
      </div>
      <p className="text-[11px] text-[var(--text-muted)]">Geram doações pendentes a cada período (comando gerar_contribuicoes); a equipe confirma ao receber.</p>
      {itens === null ? (
        <p className="text-xs text-[var(--text-muted)]">Carregando…</p>
      ) : itens.length === 0 && !form ? (
        <p className="text-xs text-[var(--text-muted)]">Nenhuma contribuição cadastrada.</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)] border border-[var(--border)] rounded-lg">
          {itens.map(c => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <p className="text-[var(--text-primary)]">{formatBRL(c.valor)} · {c.periodicidade_display}</p>
                <p className="text-[11px] text-[var(--text-muted)]">Vence dia {c.dia_vencimento} · desde {formatData(c.data_inicio)} · {c.ativa ? 'Ativa' : 'Pausada'}</p>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => alternar(c)} className="px-2 py-1 rounded-lg text-[11px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
                  {c.ativa ? 'Pausar' : 'Reativar'}
                </button>
                <button type="button" onClick={() => excluir(c)} className="px-2 py-1 rounded-lg text-[11px] border border-[var(--border)] text-red-600 hover:bg-red-50">
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {form && (
        <form onSubmit={salvar} className="space-y-3 border border-[var(--border)] rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Valor (R$)">
              <Input type="number" min="0.01" step="0.01" value={form.valor} onChange={muda('valor')} required />
            </Campo>
            <Campo label="Periodicidade">
              <Select value={form.periodicidade} onChange={muda('periodicidade')}>
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </Select>
            </Campo>
            <Campo label="Dia do vencimento (1 a 28)">
              <Input type="number" min="1" max="28" value={form.dia_vencimento} onChange={muda('dia_vencimento')} required />
            </Campo>
            <Campo label="Início">
              <CampoData name="data_inicio" value={form.data_inicio} onChange={muda('data_inicio')} required />
            </Campo>
          </div>
          <Campo label="Forma de pagamento">
            <Select value={form.forma_pagamento} onChange={muda('forma_pagamento')}>
              {FORMAS_PAGAMENTO.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </Select>
          </Campo>
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)} className="px-3 py-1.5 rounded-lg text-xs border border-[var(--border)] text-[var(--text-secondary)]">Cancelar</button>
            <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#0f4c5c' }}>Salvar contribuição</button>
          </div>
        </form>
      )}
    </section>
  )
}

function EditApoiador({ record, onSaved, onCancel }) {
  const [form, setForm] = useState({ nome: record.nome, email: record.email, status: record.status })
  const [salvando, setSalvando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await api.put(`/apoiadores/${record.id}/`, form)
      onSaved()
    } catch { alert('Erro ao salvar.') }
    finally { setSalvando(false) }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Nome completo">
        <Input name="nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
      </Campo>
      <Campo label="E-mail">
        <Input name="email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
      </Campo>
      <Campo label="Status">
        <Select name="status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </Select>
      </Campo>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
          <XCircle size={14} /> Cancelar
        </button>
        <button type="submit" disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ── Detalhe Despesa (somente leitura) ───────────────────────
function DetalheDespesa({ record }) {
  async function baixar(anexo) {
    try {
      const { data } = await api.get(`/despesas/${record.id}/anexos/${anexo.id}/download/`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = anexo.nome_original || 'anexo'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Não foi possível baixar o anexo.')
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-[var(--text-primary)] text-base">{record.descricao}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {record.categoria_display}
          {record.is_fixed && record.recurrence_period_display ? ` · despesa fixa (${record.recurrence_period_display.toLowerCase()})` : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <InfoBox label="Valor" value={formatBRL(record.valor)} destaque />
        <InfoBox label="Status" value={<BadgeStatus status={record.status_efetivo} />} />
        <InfoBox label="Vencimento" value={formatData(record.data_vencimento)} />
        <InfoBox label="Pagamento" value={formatData(record.data_pagamento)} />
      </div>
      {record.anexos?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">Anexos</p>
          {record.anexos.map((a) => (
            <button key={a.id} type="button" onClick={() => baixar(a)} className="block text-sm text-teal-700 hover:underline truncate">
              {a.nome_original}
            </button>
          ))}
        </div>
      )}
      <a href="/admin/custos"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        style={{ backgroundColor: '#0f4c5c' }}>
        <Pencil size={14} aria-hidden="true" /> Abrir em Custos
      </a>
    </div>
  )
}

// ── Caixa de info ────────────────────────────────────────────
function InfoBox({ label, value, destaque }) {
  return (
    <div className="bg-[var(--bg-card-alt)] rounded-lg px-3 py-2.5">
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
      <div className={`text-sm font-medium ${destaque ? 'text-teal-700' : 'text-[var(--text-primary)]'}`}>{value}</div>
    </div>
  )
}

const modeloMap = { doacao: 'Doacao', campanha: 'Campanha', apoiador: 'Apoiador', despesa: 'Despesa' }

function HistoricoRegistro({ tipo, id }) {
  const [logs, setLogs] = useState(null)
  useEffect(() => {
    api.get('/historico/', { params: { modelo: modeloMap[tipo], objeto_id: id, page_size: 100 } })
      .then((r) => setLogs(r.data.results ?? r.data))
      .catch(() => setLogs([]))
  }, [tipo, id])
  if (logs === null) return <p className="text-xs text-[var(--text-muted)]">Carregando histórico…</p>
  if (logs.length === 0) return <p className="text-xs text-[var(--text-muted)]">Nenhuma alteração registrada.</p>
  return (
    <ol className="space-y-3">
      {logs.map((l) => (
        <li key={l.id} className="border-l-2 border-[var(--border)] pl-3">
          <p className="text-xs text-[var(--text-muted)]">{formatarMomento(l.data)} · {l.usuario_nome} · {l.acao_display}</p>
          {l.campo !== '*' ? (
            <p className="text-sm text-[var(--text-primary)]">
              <strong>{l.campo}</strong>: <span className="text-[var(--text-muted)] line-through">{l.antes || '—'}</span> → {l.depois || '—'}
            </p>
          ) : (
            <p className="text-xs text-[var(--text-secondary)] break-words">{l.depois || l.antes}</p>
          )}
        </li>
      ))}
    </ol>
  )
}

const endpointMap = { doacao: 'doacoes', campanha: 'campanhas', apoiador: 'apoiadores', despesa: 'despesas' }
const tituloMap = { doacao: 'Doação', campanha: 'Campanha', apoiador: 'Membro', despesa: 'Despesa' }
const corMap = { doacao: '#22c55e', campanha: '#f97316', apoiador: '#3b82f6', despesa: '#dc2626' }

export const TIPOS_COM_DETALHE = Object.keys(endpointMap)

// ── Drawer principal ────────────────────────────────────────
export default function RecordDetailDrawer({ target, onClose, onRefresh }) {
  const [record, setRecord] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState(false)
  const [apoiadores, setApoiadores] = useState([])
  const [campanhas, setCampanhas] = useState([])
  const [aba, setAba] = useState('detalhes')
  const { usuario } = useAuth()

  useEffect(() => {
    if (!target) return
    setAba('detalhes')
    const ep = endpointMap[target.type]
    if (!ep) return
    setCarregando(true)
    setEditando(false)
    const reqs = [api.get(`/${ep}/${target.id}/`)]
    if (target.type === 'doacao') {
      reqs.push(api.get('/apoiadores/opcoes/'))
      reqs.push(api.get('/campanhas/opcoes/'))
    }
    Promise.all(reqs)
      .then(([r, a, c]) => {
        setRecord(r.data)
        if (a) {
          const membros = a.data
          if (r.data.apoiador && !membros.some(m => m.id === r.data.apoiador)) {
            membros.unshift({ id: r.data.apoiador, nome: r.data.apoiador_nome })
          }
          setApoiadores(membros)
        }
        if (c) {
          const camps = c.data
          if (r.data.campanha && !camps.some(x => x.id === r.data.campanha)) {
            camps.unshift({ id: r.data.campanha, titulo: `${r.data.campanha_titulo} (encerrada)` })
          }
          setCampanhas(camps)
        }
      })
      .catch(() => setRecord(null))
      .finally(() => setCarregando(false))
  }, [target])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!target || !endpointMap[target.type]) return null

  function handleSaved() {
    setEditando(false)
    onRefresh?.()
    const ep = endpointMap[target.type]
    api.get(`/${ep}/${target.id}/`).then(r => setRecord(r.data))
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: corMap[target.type] }}
            >
              {tituloMap[target.type]}
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              {editando ? `Editar ${tituloMap[target.type]}` : 'Detalhes'}
            </span>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        {usuario?.is_superuser && !editando && (
          <div role="tablist" className="flex gap-1 px-6 pt-3 border-b border-[var(--border)] flex-shrink-0">
            {[['detalhes', 'Detalhes'], ['historico', 'Histórico']].map(([id, rotulo]) => (
              <button
                key={id}
                role="tab"
                aria-selected={aba === id}
                onClick={() => setAba(id)}
                className="px-3 py-2 text-xs font-semibold border-b-2 -mb-px"
                style={{ borderColor: aba === id ? '#0f4c5c' : 'transparent', color: aba === id ? '#0f4c5c' : 'var(--text-muted)' }}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {aba === 'historico' ? (
            <HistoricoRegistro tipo={target.type} id={target.id} />
          ) : carregando ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
            </div>
          ) : !record ? (
            <p className="text-slate-400 text-sm text-center py-12">Registro não encontrado.</p>
          ) : editando ? (
            <>
              {target.type === 'doacao' && (
                <EditDoacao record={record} apoiadores={apoiadores} campanhas={campanhas}
                  onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
              {target.type === 'campanha' && (
                <EditCampanha record={record} onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
              {target.type === 'apoiador' && (
                <EditApoiador record={record} onSaved={handleSaved} onCancel={() => setEditando(false)} />
              )}
            </>
          ) : (
            <>
              {target.type === 'doacao' && <DetalheDoacao record={record} onEdit={() => setEditando(true)} />}
              {target.type === 'campanha' && <DetalheCampanha record={record} onEdit={() => setEditando(true)} />}
              {target.type === 'apoiador' && <DetalheApoiador record={record} onEdit={() => setEditando(true)} onAlterado={handleSaved} />}
              {target.type === 'despesa' && <DetalheDespesa record={record} />}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
