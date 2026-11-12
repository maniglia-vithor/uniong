import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HeartHandshake, DollarSign, Megaphone, Users, TrendingUp,
  Receipt, ShieldOff, ArrowLeft, X, ExternalLink,
  CheckCircle, Plus, HandHeart,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import axios from 'axios'
import BarraProgresso from '../components/BarraProgresso'
import QrCodePix from '../components/QrCodePix'
import CompartilharCampanha from '../components/CompartilharCampanha'
import ResumoCampanha from '../components/ResumoCampanha'
import PrestacaoContas from '../components/PrestacaoContas'
import ListaDespesasPublicas from '../components/ListaDespesasPublicas'
import { corDeTexto, mensagemErro } from '../utils/formatos'
import { useAuth } from '../context/AuthContext'
import useInstituicao from '../hooks/useInstituicao'
import useDialogo from '../hooks/useDialogo'
import LogoInstituicao from '../components/LogoInstituicao'
import RodapeInstituicao from '../components/RodapeInstituicao'
import GraficoAcessivel from '../components/GraficoAcessivel'

// Data de referência fixada ao carregar a página (evita chamar Date durante a renderização).
const HOJE = new Date()

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

const CORES_CAMPANHA = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed']
const CORES_PIE = ['#0f4c5c', '#f97316', '#0891b2', '#7c3aed', '#10b981', '#ec4899']

/* ─── KPI Card ─────────────────────────────────────────────────────────── */
function KpiCard({ label, valor, desc, icone: Icon, cor, onClick }) {
  const base = 'bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5 flex flex-col gap-3 text-left w-full'
  const interactive = onClick ? ' cursor-pointer hover:shadow-md hover:border-[var(--text-muted)] transition-all' : ''
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={base + interactive} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cor}22` }}>
          <Icon size={20} style={{ color: cor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[var(--text-primary)] leading-tight whitespace-nowrap">{valor}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-muted)]">{desc}</p>
        {onClick && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ backgroundColor: `${cor}18`, color: corDeTexto(cor) }}>
            Ver detalhes
          </span>
        )}
      </div>
    </Tag>
  )
}

/* ─── Overlay Modal ─────────────────────────────────────────────────────── */
function Overlay({ titulo, onFechar, children, largura = 'max-w-lg' }) {
  const { ref, tituloId } = useDialogo(onFechar)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1}
        className={`bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border)] w-full ${largura} max-h-[90vh] flex flex-col outline-none`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 id={tituloId} className="font-bold text-[var(--text-primary)] text-base">{titulo}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Donation Modal ─────────────────────────────────────────────────────── */
function DonationModal({ campanhas, pix, onFechar }) {
  const [form, setForm] = useState({ nome: '', email: '', celular: '', campaign_id: '', valor: '', consentimento: false, site: '' })
  const [salvando, setSalvando] = useState(false)
  const [registro, setRegistro] = useState(null)
  const [erro, setErro] = useState(null)

  function onChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      const { data } = await axios.post('/api/public/doacoes/', {
        nome: form.nome,
        email: form.email,
        celular: form.celular,
        campaign_id: form.campaign_id || null,
        valor: form.valor,
        consentimento: form.consentimento,
        site: form.site,
      })
      setRegistro(data)
    } catch (err) {
      setErro(mensagemErro(err, 'Erro ao registrar doação. Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

  if (registro) {
    return (
      <Overlay titulo="Intenção de doação registrada" onFechar={onFechar}>
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <CheckCircle size={44} className="text-emerald-500" aria-hidden="true" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Obrigado pela sua contribuição!</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm">
            Para concluir, pague o PIX abaixo. A equipe confirma a doação assim que o valor aparecer no extrato.
          </p>
          {registro.id && (
            <div className="w-full text-left">
              <QrCodePix
                pix={pix}
                txid={registro.txid}
                valor={registro.valor}
                descricao={`PIX de ${formatBRL(registro.valor)} — identificação ${registro.txid}.`}
              />
            </div>
          )}
          <button onClick={onFechar} className="mt-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#0f4c5c' }}>
            Fechar
          </button>
        </div>
      </Overlay>
    )
  }

  return (
    <Overlay titulo="Realizar Doação" onFechar={onFechar}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Campanha</label>
          <select name="campaign_id" value={form.campaign_id} onChange={onChange} className={inputCls}>
            <option value="">Doação geral (sem campanha)</option>
            {campanhas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nome completo *</label>
          <input name="nome" value={form.nome} onChange={onChange} required placeholder="Maria da Silva" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">E-mail *</label>
          <input name="email" type="email" value={form.email} onChange={onChange} required placeholder="maria@email.com" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Celular</label>
          <input name="celular" value={form.celular} onChange={onChange} placeholder="(11) 99999-9999" className={inputCls} />
        </div>
        <div>
          <label htmlFor="doacao-valor" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Valor (R$) *</label>
          <input id="doacao-valor" name="valor" type="number" min="1" max="100000" step="0.01" value={form.valor} onChange={onChange} required placeholder="50,00" className={inputCls} />
        </div>
        {/* Campo isca para robôs: oculto para pessoas e leitores de tela. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label htmlFor="doacao-site">Site</label>
          <input id="doacao-site" name="site" value={form.site} onChange={onChange} tabIndex={-1} autoComplete="off" />
        </div>
        <label className="flex items-start gap-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" name="consentimento" checked={form.consentimento} onChange={onChange} required className="mt-0.5" />
          <span>
            Li e concordo com a{' '}
            <Link to="/privacidade" target="_blank" className="underline" style={{ color: 'var(--marca-texto)' }}>política de privacidade</Link>.
          </span>
        </label>
        {erro && <p className="text-xs text-red-500" role="alert">{erro}</p>}
        <button
          type="submit"
          disabled={salvando}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          {salvando ? 'Registrando…' : 'Confirmar Doação'}
        </button>
      </form>
    </Overlay>
  )
}

/* ─── Expenses Modal ─────────────────────────────────────────────────────── */
function GastosModal({ lista, total, onFechar }) {
  const mesAtual = HOJE.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return (
    <Overlay titulo={`Gastos do Mês — ${mesAtual}`} onFechar={onFechar} largura="max-w-xl">
      <ListaDespesasPublicas lista={lista} vazio="Nenhum gasto pago neste mês." />
      {lista.length > 0 && (
        <div className="flex justify-end pt-3 mt-3 border-t border-[var(--border)]">
          <span className="text-sm font-bold text-[var(--text-primary)]">Total: {formatBRL(total)}</span>
        </div>
      )}
    </Overlay>
  )
}

/* ─── Campaign Detail Modal ──────────────────────────────────────────────── */
function CampanhaModal({ campanha, pix, onFechar }) {
  const idQr = `qr-campanha-${campanha.id}`
  return (
    <Overlay titulo={campanha.titulo} onFechar={onFechar} largura="max-w-lg">
      <div className="space-y-6">
        <ResumoCampanha campanha={campanha} />
        <Link
          to={`/transparencia/campanha/${campanha.id}`}
          className="inline-flex text-sm font-semibold underline"
          style={{ color: 'var(--marca-texto)' }}
        >
          Ver página da campanha e prestação de contas
        </Link>
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Doar via PIX</h3>
          <QrCodePix
            pix={pix}
            txid={`CAMPANHA${campanha.id}`}
            idCanvas={idQr}
            descricao="Escaneie o QR Code com o aplicativo do seu banco ou use o PIX copia e cola para doar para esta campanha."
          />
        </div>
        <CompartilharCampanha campanha={campanha} idQr={idQr} />
      </div>
    </Overlay>
  )
}
/* ─── Comunicados ───────────────────────────────────────────────────────── */
function formatDataHora(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function ComunicadoItem({ comunicado: c }) {
  const textoRef = useRef(null)
  const [aberto, setAberto] = useState(false)
  const [extenso, setExtenso] = useState(false)

  useLayoutEffect(() => {
    const el = textoRef.current
    if (!el || aberto) return
    const medir = () => setExtenso(el.scrollHeight > el.clientHeight + 1)
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [aberto, c.conteudo])

  return (
    <article className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-5">
      <p className="text-xs text-[var(--text-muted)] mb-1">{formatDataHora(c.data_publicacao)}</p>
      <h3 className="font-semibold text-[var(--text-primary)] mb-2">{c.titulo}</h3>
      <p
        ref={textoRef}
        id={`comunicado-${c.id}`}
        className={`text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed ${aberto ? '' : 'line-clamp-6'}`}
      >
        {c.conteudo}
      </p>
      {(extenso || aberto) && (
        <button
          type="button"
          onClick={() => setAberto(v => !v)}
          aria-expanded={aberto}
          aria-controls={`comunicado-${c.id}`}
          className="mt-2 text-xs font-semibold hover:underline"
          style={{ color: 'var(--marca-texto)' }}
        >
          {aberto ? 'Mostrar menos' : 'Ler mais'}
        </button>
      )}
    </article>
  )
}

function Comunicados({ lista }) {
  return (
    <section>
      <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
        <Megaphone size={16} className="text-[var(--text-muted)]" />
        Comunicados
      </h2>
      {lista.length === 0 ? (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm py-10 text-center text-sm text-[var(--text-muted)]">
          Nenhum comunicado publicado ainda.
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(c => <ComunicadoItem key={c.id} comunicado={c} />)}
        </div>
      )}
    </section>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function Transparencia() {
  const instituicao = useInstituicao()
  const { autenticado } = useAuth()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [donationModal, setDonationModal] = useState(false)
  const [gastosModal, setGastosModal] = useState(false)
  const [campanhaModal, setCampanhaModal] = useState(null)
  const [indisponivel, setIndisponivel] = useState(false)

  useEffect(() => {
    axios.get('/api/public/transparencia/')
      .then(r => setDados(r.data))
      .catch((err) => {
        if (err.response?.status === 404) setIndisponivel(true)
        else setErro('Não foi possível carregar os dados. Verifique a conexão com o servidor.')
      })
      .finally(() => setCarregando(false))
  }, [])

  if (indisponivel) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex items-center justify-center px-4">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-8 max-w-md text-center space-y-3">
          <ShieldOff size={32} className="mx-auto text-[var(--text-muted)]" aria-hidden="true" />
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Portal indisponível</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            O portal de transparência está temporariamente desativado pela organização.
          </p>
          {autenticado && (
            <Link to="/admin" className="inline-block text-sm font-medium underline" style={{ color: 'var(--marca-texto)' }}>Voltar ao painel</Link>
          )}
        </div>
      </div>
    )
  }

  const dadosGraficoCampanhas = dados?.campanhas?.map(c => ({
    name: c.titulo.length > 22 ? c.titulo.slice(0, 20) + '…' : c.titulo,
    arrecadado: Number(c.valor_arrecadado),
    meta: Number(c.meta_valor),
  })) ?? []

  const dadosPie = dados?.campanhas?.map((c, i) => ({
    name: c.titulo.length > 22 ? c.titulo.slice(0, 20) + '…' : c.titulo,
    value: Number(c.valor_arrecadado),
    fill: CORES_PIE[i % CORES_PIE.length],
  })).filter(c => c.value > 0) ?? []

  const chartHeight = Math.max(220, dadosGraficoCampanhas.length * 55)

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {autenticado && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0f4c5c' }}
          >
            <ArrowLeft size={15} />
            Voltar ao Painel
          </Link>
        )}

        {/* Hero Banner */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <LogoInstituicao instituicao={instituicao} className="h-16 w-16 text-2xl" />
            <div>
              {instituicao.configurada && (
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--marca-texto)' }}>{instituicao.nome}</p>
              )}
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Portal de Transparência</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
                {instituicao.descricao || 'Acompanhe em tempo real o impacto das nossas campanhas, o total arrecadado e como cada doação está sendo utilizada pela nossa comunidade.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDonationModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 whitespace-nowrap flex-shrink-0"
            style={{ backgroundColor: '#0f4c5c' }}
          >
            <Plus size={15} />
            Realizar doação
          </button>
        </div>

        {carregando && (
          <div className="flex justify-center py-24">
            <div className="w-10 h-10 border-4 border-[var(--border)] rounded-full animate-spin" style={{ borderTopColor: '#0f4c5c' }} />
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center gap-3 text-red-600 text-sm">
            <ShieldOff size={20} className="flex-shrink-0" />
            {erro}
          </div>
        )}

        {dados && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <KpiCard
                label="Total Arrecadado"
                valor={formatBRL(dados.kpis.total_arrecadado)}
                desc="Todas as doações confirmadas"
                icone={DollarSign}
                cor="#0f4c5c"
              />
              <KpiCard
                label="Doações do Mês"
                valor={formatBRL(dados.kpis.doacoes_mes)}
                desc={`Desde 01/${String(HOJE.getMonth() + 1).padStart(2, '0')}/${HOJE.getFullYear()}`}
                icone={TrendingUp}
                cor="#0891b2"
              />
              <KpiCard
                label="Membros Ativos"
                valor={dados.kpis.apoiadores_ativos}
                desc="Com status Ativo"
                icone={Users}
                cor="#7c3aed"
              />
              <KpiCard
                label="Gastos do Mês"
                valor={formatBRL(dados.kpis.gastos_mes)}
                desc="Despesas pagas no mês"
                icone={Receipt}
                cor="#f97316"
                onClick={() => setGastosModal(true)}
              />
            </div>
            {dados.kpis.horas_voluntariado > 0 && (
              <p className="flex items-center gap-2 text-sm text-[var(--text-secondary)] -mt-4">
                <HandHeart size={16} aria-hidden="true" style={{ color: '#db2777' }} />
                <span>
                  <strong className="text-[var(--text-primary)]">
                    {Number(dados.kpis.horas_voluntariado).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} horas
                  </strong>{' '}
                  de trabalho voluntário registradas pela nossa comunidade.
                </span>
              </p>
            )}

            {/* Campanhas em Andamento */}
            <section>
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Megaphone size={16} style={{ color: 'var(--destaque-texto)' }} />
                Campanhas em Andamento
                <span className="text-xs font-normal text-[var(--text-muted)]">— clique para detalhes e PIX</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dados.campanhas.map((c, i) => {
                  const cor = CORES_CAMPANHA[i % CORES_CAMPANHA.length]
                  return (
                    <button
                      type="button"
                      key={c.id}
                      className="text-left w-full bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-[var(--text-muted)] transition-all"
                      onClick={() => setCampanhaModal(c)}
                    >
                      {c.imagem_url && (
                        <img src={c.imagem_url} alt="" className="w-full h-36 object-cover rounded-xl mb-4" />
                      )}
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-[var(--text-primary)] leading-snug pr-2">{c.titulo}</h3>
                        <span className="text-lg font-bold flex-shrink-0" style={{ color: corDeTexto(cor) }}>
                          {c.percentual_progresso}%
                        </span>
                      </div>
                      <BarraProgresso percentual={c.percentual_progresso} cor={cor} />
                      <div className="flex justify-between mt-3 text-sm">
                        <div>
                          <p className="text-xs text-[var(--text-muted)]">Arrecadado</p>
                          <p className="font-bold text-[var(--text-primary)]">{formatBRL(c.valor_arrecadado)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[var(--text-muted)]">Meta</p>
                          <p className="font-semibold text-[var(--text-secondary)]">{formatBRL(c.meta_valor)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
                {dados.campanhas.length === 0 && (
                  <p className="col-span-2 text-center py-10 text-[var(--text-muted)] text-sm">
                    Nenhuma campanha ativa no momento.
                  </p>
                )}
              </div>
            </section>

            {/* Gráficos */}
            {dadosGraficoCampanhas.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Bar: Arrecadado vs Meta — altura dinâmica */}
                <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                  <GraficoAcessivel
                    titulo="Arrecadado vs Meta por Campanha"
                    cabecalho={(
                      <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <TrendingUp size={15} aria-hidden="true" style={{ color: 'var(--marca-texto)' }} />
                        Arrecadado vs Meta por Campanha
                      </h2>
                    )}
                    descricao="Valor arrecadado (doações confirmadas) e meta de cada campanha em andamento."
                    colunas={[
                      { chave: 'name', rotulo: 'Campanha' },
                      { chave: 'arrecadado', rotulo: 'Arrecadado', formato: (v) => formatBRL(v) },
                      { chave: 'meta', rotulo: 'Meta', formato: (v) => formatBRL(v) },
                    ]}
                    linhas={dadosGraficoCampanhas}
                  >
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={dadosGraficoCampanhas} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={v => formatBRL(v)}
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="arrecadado" name="Arrecadado" fill="#0f4c5c" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="meta" name="Meta" fill="#f97316" opacity={0.5} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </GraficoAcessivel>
                </div>

                {/* Pie: Distribuição */}
                {dadosPie.length > 0 && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                    <GraficoAcessivel
                      titulo="Distribuição de Arrecadação"
                      cabecalho={(
                        <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                          <Receipt size={15} aria-hidden="true" style={{ color: '#7c3aed' }} />
                          Distribuição de Arrecadação
                        </h2>
                      )}
                      descricao="Participação de cada campanha no total arrecadado pelas campanhas em andamento."
                      colunas={[{ chave: 'name', rotulo: 'Campanha' }, { chave: 'value', rotulo: 'Arrecadado', formato: (v) => formatBRL(v) }]}
                      linhas={dadosPie}
                    >
                    <ResponsiveContainer width="100%" height={chartHeight}>
                      <PieChart>
                        <Pie data={dadosPie} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {dadosPie.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip
                          formatter={v => formatBRL(v)}
                          contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    </GraficoAcessivel>
                  </div>
                )}
              </div>
            )}

            <PrestacaoContas />

            <Comunicados lista={dados.comunicados ?? []} />

            {/* Rodapé informativo */}
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 flex items-start gap-3 text-sm text-[var(--text-muted)]">
              <HeartHandshake size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--marca-texto)' }} />
              <p>
                Todos os dados exibidos são públicos e atualizados em tempo real.
                Esta página reflete o compromisso da organização com a transparência e prestação de contas à comunidade.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-card)] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
          <RodapeInstituicao instituicao={instituicao} />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap gap-2 items-center justify-between text-xs text-[var(--text-muted)]">
          <span>© {HOJE.getFullYear()} {instituicao.nome} · Portal de Transparência · desenvolvido com UniONG</span>
          <Link to="/login" className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors">
            <ExternalLink size={11} /> Acesso Administrativo
          </Link>
        </div>
      </footer>

      {/* Modals */}
      {donationModal && (
        <DonationModal campanhas={dados?.campanhas ?? []} pix={dados?.pix} onFechar={() => setDonationModal(false)} />
      )}
      {gastosModal && dados && (
        <GastosModal
          lista={dados.gastos_mes_lista ?? []}
          total={dados.kpis.gastos_mes}
          onFechar={() => setGastosModal(false)}
        />
      )}
      {campanhaModal && (
        <CampanhaModal campanha={campanhaModal} pix={dados?.pix} onFechar={() => setCampanhaModal(null)} />
      )}
    </div>
  )
}
