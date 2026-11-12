import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HeartHandshake, DollarSign, Megaphone, Users, TrendingUp,
  Receipt, ShieldOff, ArrowLeft, X, ExternalLink, Share2,
  CheckCircle, Plus,
} from 'lucide-react'
import { FaWhatsapp, FaInstagram, FaFacebook, FaLinkedin, FaTiktok } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import axios from 'axios'
import BarraProgresso from '../components/BarraProgresso'
import { useRole } from '../context/RoleContext'
import logoUniONG from '../assets/Gemini_Generated_Image_g792fng792fng792.jpg'

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : ''

function formatBRL(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v ?? 0)
}

function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
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
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0" style={{ backgroundColor: `${cor}18`, color: cor }}>
            Ver detalhes
          </span>
        )}
      </div>
    </Tag>
  )
}

/* ─── Overlay Modal ─────────────────────────────────────────────────────── */
function Overlay({ titulo, onFechar, children, largura = 'max-w-lg' }) {
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onFechar() }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
  }, [onFechar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className={`bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border)] w-full ${largura} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <h2 className="font-bold text-[var(--text-primary)] text-base">{titulo}</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
            <X size={16} />
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
function DonationModal({ campanhas, onFechar }) {
  const [form, setForm] = useState({ nome: '', email: '', celular: '', campaign_id: '', valor: '' })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState(null)

  function onChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function onSubmit(e) {
    e.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await axios.post('/api/public/doacoes/', {
        nome: form.nome,
        email: form.email,
        celular: form.celular,
        campaign_id: form.campaign_id || null,
        valor: form.valor || 0,
      })
      setSucesso(true)
    } catch (err) {
      setErro(err?.response?.data?.erro || 'Erro ao registrar doação. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100'

  if (sucesso) {
    return (
      <Overlay titulo="Doação Registrada!" onFechar={onFechar}>
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <CheckCircle size={48} className="text-emerald-500" />
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Obrigado pela sua contribuição!</h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-sm">
            Sua intenção de doação foi registrada com sucesso. Nossa equipe entrará em contato para confirmar o pagamento.
          </p>
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
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Valor (R$)</label>
          <input name="valor" type="number" min="1" step="0.01" value={form.valor} onChange={onChange} placeholder="50,00" className={inputCls} />
        </div>
        {erro && <p className="text-xs text-red-500">{erro}</p>}
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
  const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  return (
    <Overlay titulo={`Gastos do Mês — ${mesAtual}`} onFechar={onFechar} largura="max-w-xl">
      {lista.length === 0 ? (
        <p className="text-center py-8 text-[var(--text-muted)] text-sm">Nenhum gasto registrado neste mês.</p>
      ) : (
        <>
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left text-xs font-medium text-[var(--text-muted)] py-2">Descrição</th>
                <th className="text-left text-xs font-medium text-[var(--text-muted)] py-2">Categoria</th>
                <th className="text-right text-xs font-medium text-[var(--text-muted)] py-2">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.map((g, i) => (
                <tr key={i} className="hover:bg-[var(--bg-hover)]">
                  <td className="py-2.5 text-[var(--text-primary)] font-medium pr-4">{g.descricao}</td>
                  <td className="py-2.5 text-[var(--text-secondary)]">{g.categoria}</td>
                  <td className="py-2.5 text-right font-semibold text-[var(--text-primary)]">{formatBRL(g.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end pt-2 border-t border-[var(--border)]">
            <span className="text-sm font-bold text-[var(--text-primary)]">Total: {formatBRL(total)}</span>
          </div>
        </>
      )}
    </Overlay>
  )
}

/* ─── Campaign Detail Modal ──────────────────────────────────────────────── */
function CampanhaModal({ campanha, onFechar }) {
  const qrData = encodeURIComponent(`PIX:UniONG:${campanha.titulo}:${campanha.id}`)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}&color=0f4c5c`

  const [aviso, setAviso] = useState(null)

  const link = `${BASE_URL}/transparencia`
  const texto = `Apoie a campanha "${campanha.titulo}" da UniONG! Já arrecadamos ${formatBRL(campanha.valor_arrecadado)} de ${formatBRL(campanha.meta_valor)}. Doe via PIX:`
  const textoCompleto = `${texto} ${link}`
  const t = encodeURIComponent(texto)
  const tc = encodeURIComponent(textoCompleto)
  const u = encodeURIComponent(link)

  function abrirPopup(url) {
    window.open(url, '_blank', 'noopener,noreferrer,width=640,height=640')
  }

  // Instagram e TikTok não têm URL de compartilhamento na web: usa o compartilhamento
  // nativo do aparelho (com o QR Code) e, sem suporte, copia o texto e abre a rede.
  async function compartilharSemUrl(nome, siteUrl) {
    try {
      const blob = await fetch(qrUrl).then(r => r.blob())
      const arquivo = new File([blob], 'pix-uniong.png', { type: blob.type || 'image/png' })
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ title: campanha.titulo, text: textoCompleto, files: [arquivo] })
        return
      }
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
    try {
      await navigator.clipboard.writeText(textoCompleto)
      setAviso(`Texto da campanha copiado! Cole no ${nome} para compartilhar.`)
    } catch {
      setAviso(`Abra o ${nome} e compartilhe o link: ${link}`)
    }
    window.open(siteUrl, '_blank', 'noopener,noreferrer')
  }

  const redes = [
    { label: 'WhatsApp', Icon: FaWhatsapp, cor: '#25d366', onClick: () => abrirPopup(`https://wa.me/?text=${tc}`) },
    { label: 'Instagram', Icon: FaInstagram, cor: '#e1306c', onClick: () => compartilharSemUrl('Instagram', 'https://www.instagram.com/') },
    { label: 'Facebook', Icon: FaFacebook, cor: '#1877f2', onClick: () => abrirPopup(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`) },
    { label: 'LinkedIn', Icon: FaLinkedin, cor: '#0a66c2', onClick: () => abrirPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`) },
    { label: 'E-mail', Icon: MdEmail, cor: '#ea4335', onClick: () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Apoie a campanha: ${campanha.titulo}`)}&body=${tc}` } },
    { label: 'TikTok', Icon: FaTiktok, cor: '#ff0050', onClick: () => compartilharSemUrl('TikTok', 'https://www.tiktok.com/') },
  ]

  return (
    <Overlay titulo={campanha.titulo} onFechar={onFechar} largura="max-w-lg">
      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between mb-1.5 text-sm">
          <span className="text-[var(--text-muted)]">Progresso</span>
          <span className="font-bold" style={{ color: '#0f4c5c' }}>{campanha.percentual_progresso}%</span>
        </div>
        <BarraProgresso percentual={campanha.percentual_progresso} cor="#0f4c5c" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Arrecadado', valor: formatBRL(campanha.valor_arrecadado), cor: '#0f4c5c' },
          { label: 'Meta', valor: formatBRL(campanha.meta_valor), cor: '#f97316' },
          { label: 'Início', valor: formatData(campanha.data_inicio), cor: '#0891b2' },
          { label: 'Encerramento', valor: campanha.data_fim ? formatData(campanha.data_fim) : 'Em aberto', cor: '#7c3aed' },
        ].map(item => (
          <div key={item.label} className="bg-[var(--bg-card-alt)] rounded-xl p-3 border border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] mb-0.5">{item.label}</p>
            <p className="font-bold text-sm text-[var(--text-primary)]" style={{ color: item.cor }}>{item.valor}</p>
          </div>
        ))}
      </div>

      {/* PIX QR Code */}
      <div className="bg-[var(--bg-card-alt)] rounded-xl border border-[var(--border)] p-4 mb-5 flex flex-col items-center gap-3">
        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">PIX — Doe agora</p>
        <img
          src={qrUrl}
          alt="QR Code PIX"
          className="w-[160px] h-[160px] rounded-xl border border-[var(--border)]"
          onError={e => { e.target.style.display = 'none' }}
        />
        <p className="text-[10px] text-center text-[var(--text-muted)] max-w-xs">
          Escaneie o QR Code com o app do seu banco para realizar uma doação via PIX para esta campanha.
        </p>
      </div>

      {/* Share */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Share2 size={14} className="text-[var(--text-muted)]" />
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Compartilhar campanha</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {redes.map(({ label, Icon, cor, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Icon size={18} style={{ color: cor }} className="flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
        {aviso && (
          <p className="mt-3 text-xs text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
            {aviso}
          </p>
        )}
      </div>
    </Overlay>
  )
}

/* ─── Main Page ─────────────────────────────────────────────────────────── */
export default function Transparencia() {
  const { role, switchRole } = useRole()
  const navigate = useNavigate()
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [donationModal, setDonationModal] = useState(false)
  const [gastosModal, setGastosModal] = useState(false)
  const [campanhaModal, setCampanhaModal] = useState(null)

  useEffect(() => {
    axios.get('/api/public/transparencia/')
      .then(r => setDados(r.data))
      .catch(() => setErro('Não foi possível carregar os dados. Verifique a conexão com o servidor.'))
      .finally(() => setCarregando(false))
  }, [])

  function voltarParaAdmin() {
    switchRole('admin')
    navigate('/admin')
  }

  const dadosGraficoCampanhas = dados?.campanhas?.map(c => ({
    name: c.titulo.length > 22 ? c.titulo.slice(0, 20) + '…' : c.titulo,
    arrecadado: Number(c.valor_arrecadado),
    meta: Number(c.meta_valor),
  })) ?? []

  const dadosPie = dados?.distribuicao?.map((d, i) => ({
    name: d.nome.length > 22 ? d.nome.slice(0, 20) + '…' : d.nome,
    value: d.valor,
    fill: d.nome === 'Sem campanha' ? '#94a3b8' : CORES_PIE[i % CORES_PIE.length],
  })) ?? []

  const chartHeight = Math.max(220, dadosGraficoCampanhas.length * 55)

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {role === 'membro' && (
          <button
            onClick={voltarParaAdmin}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0f4c5c' }}
          >
            <ArrowLeft size={15} />
            Voltar ao Painel
          </button>
        )}

        {/* Hero Banner */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <img src={logoUniONG} alt="UniONG" className="h-16 w-16 object-contain rounded-xl flex-shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Portal de Transparência</h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-xl">
                Acompanhe em tempo real o impacto das nossas campanhas, o total arrecadado
                e como cada doação está sendo utilizada pela nossa comunidade.
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
                desc={`Desde 01/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`}
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
                desc="Despesas do mês atual"
                icone={Receipt}
                cor="#f97316"
                onClick={() => setGastosModal(true)}
              />
            </div>

            {/* Campanhas em Andamento */}
            <section>
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Megaphone size={16} style={{ color: '#f97316' }} />
                Campanhas em Andamento
                <span className="text-xs font-normal text-[var(--text-muted)]">— clique para detalhes e PIX</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dados.campanhas.map((c, i) => {
                  const cor = CORES_CAMPANHA[i % CORES_CAMPANHA.length]
                  return (
                    <div
                      key={c.id}
                      className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5 cursor-pointer hover:shadow-md hover:border-[var(--text-muted)] transition-all"
                      onClick={() => setCampanhaModal(c)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-[var(--text-primary)] leading-snug pr-2">{c.titulo}</h3>
                        <span className="text-lg font-bold flex-shrink-0" style={{ color: cor }}>
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
                    </div>
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
                  <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <TrendingUp size={15} style={{ color: '#0f4c5c' }} />
                    Arrecadado vs Meta por Campanha
                  </h2>
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
                </div>

                {/* Pie: Distribuição */}
                {dadosPie.length > 0 && (
                  <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm p-5">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <Receipt size={15} style={{ color: '#7c3aed' }} />
                      Distribuição de Arrecadação
                    </h2>
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
                  </div>
                )}
              </div>
            )}

            {/* Doações Recentes */}
            <section>
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <DollarSign size={16} style={{ color: '#0f4c5c' }} />
                Doações Recentes
                <span className="text-xs font-normal text-[var(--text-muted)] ml-1">(nomes parcialmente anonimizados)</span>
              </h2>
              <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Doador</th>
                      <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Campanha</th>
                      <th className="text-right text-xs font-medium text-[var(--text-muted)] px-5 py-3">Valor</th>
                      <th className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {dados.doacoes_recentes.map((d, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-hover)] transition-colors">
                        <td className="px-5 py-3 font-medium text-[var(--text-primary)]">{d.doador}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">
                          {d.campanha || <span className="text-[var(--text-muted)]">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-[var(--text-primary)]">{formatBRL(d.valor)}</td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{formatData(d.data)}</td>
                      </tr>
                    ))}
                    {dados.doacoes_recentes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-5 py-10 text-center text-[var(--text-muted)] text-sm">
                          Nenhuma doação registrada ainda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Rodapé informativo */}
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] p-5 flex items-start gap-3 text-sm text-[var(--text-muted)]">
              <HeartHandshake size={18} className="flex-shrink-0 mt-0.5" style={{ color: '#0f4c5c' }} />
              <p>
                Todos os dados exibidos são públicos e atualizados em tempo real.
                Esta página reflete o compromisso da organização com a transparência e prestação de contas à comunidade.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[var(--bg-card)] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>© {new Date().getFullYear()} UniONG · Portal de Transparência</span>
          <Link to="/login" className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors">
            <ExternalLink size={11} /> Acesso Administrativo
          </Link>
        </div>
      </footer>

      {/* Modals */}
      {donationModal && (
        <DonationModal campanhas={dados?.campanhas ?? []} onFechar={() => setDonationModal(false)} />
      )}
      {gastosModal && dados && (
        <GastosModal
          lista={dados.gastos_mes_lista ?? []}
          total={dados.kpis.gastos_mes}
          onFechar={() => setGastosModal(false)}
        />
      )}
      {campanhaModal && (
        <CampanhaModal campanha={campanhaModal} onFechar={() => setCampanhaModal(null)} />
      )}
    </div>
  )
}
