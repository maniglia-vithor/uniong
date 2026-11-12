import { useEffect, useState } from 'react'
import { Save, ExternalLink, Copy, Check } from 'lucide-react'
import api from '../services/api'
import { instituicaoAlterada } from '../hooks/useInstituicao'
import { mensagemErro } from '../utils/formatos'

const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500 bg-[var(--bg-input)] text-[var(--text-primary)]'

const CAMPOS = [
  ['nome', 'Nome da instituição', { maxLength: 150, required: true }],
  ['cnpj', 'CNPJ', { placeholder: '00.000.000/0000-00', inputMode: 'numeric' }],
  ['email', 'E-mail de contato', { type: 'email' }],
  ['telefone', 'Telefone', { placeholder: '(11) 99999-9999', inputMode: 'tel' }],
  ['endereco', 'Endereço', { maxLength: 255 }],
  ['site', 'Site', { type: 'url', placeholder: 'https://' }],
  ['instagram', 'Instagram', { type: 'url', placeholder: 'https://instagram.com/...' }],
  ['facebook', 'Facebook', { type: 'url', placeholder: 'https://facebook.com/...' }],
  ['linkedin', 'LinkedIn', { type: 'url', placeholder: 'https://linkedin.com/company/...' }],
  ['youtube', 'YouTube', { type: 'url', placeholder: 'https://youtube.com/@...' }],
]

/** Endereço público do portal de transparência, com atalhos para abrir e copiar. */
function LinkPortal() {
  const url = `${window.location.origin}/transparencia`
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      window.prompt('Copie o endereço do portal:', url)
    }
  }

  return (
    <section aria-labelledby="titulo-portal" className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-alt)] p-4 space-y-2">
      <h4 id="titulo-portal" className="text-sm font-semibold text-[var(--text-primary)]">Portal de transparência</h4>
      <p className="text-xs text-[var(--text-muted)]">Página pública da organização, vista por membros, doadores e visitantes, sem login.</p>
      <div className="flex flex-wrap items-center gap-2">
        <a href={url} className="text-sm font-medium underline break-all" style={{ color: 'var(--marca-texto)' }}>{url}</a>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href="/transparencia"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <ExternalLink size={13} aria-hidden="true" /> Abrir portal
        </a>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
        >
          {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copiado ? 'Link copiado' : 'Copiar link'}
        </button>
      </div>
    </section>
  )
}

/** Dados públicos da instituição (só superusuário). Aparecem no portal, no painel, nos recibos e nos relatórios. */
export default function FormInstituicao({ avisar }) {
  const [form, setForm] = useState(null)
  const [erros, setErros] = useState({})
  const [logoUrl, setLogoUrl] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/configuracoes/instituicao/').then(({ data }) => {
      setForm({
        ...Object.fromEntries(CAMPOS.map(([c]) => [c, data[c] ?? ''])),
        cnpj: data.cnpj_formatado || '',
        descricao: data.descricao ?? '',
      })
      setLogoUrl(data.logo_url)
    }).catch(() => avisar('erro', 'Não foi possível carregar os dados da instituição.'))
  }, [avisar])

  async function salvar(e) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    try {
      const { data } = await api.patch('/configuracoes/instituicao/', form)
      setForm((f) => ({ ...f, cnpj: data.cnpj_formatado || '' }))
      instituicaoAlterada()
      avisar('ok', 'Dados da instituição salvos.')
    } catch (err) {
      const dados = err.response?.data
      if (dados && typeof dados === 'object') {
        setErros(Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, [].concat(v).join(' ')])))
      }
      avisar('erro', mensagemErro(err, 'Confira os campos destacados.'))
    } finally {
      setSalvando(false)
    }
  }

  async function enviarLogo(arquivo) {
    if (!arquivo) return
    const fd = new FormData()
    fd.append('logo', arquivo)
    try {
      const { data } = await api.post('/configuracoes/instituicao/logo/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setLogoUrl(data.logo_url)
      instituicaoAlterada()
      avisar('ok', 'Logo atualizado.')
    } catch (err) {
      avisar('erro', mensagemErro(err, 'Logo não aceito.'))
    }
  }

  async function removerLogo() {
    try {
      await api.delete('/configuracoes/instituicao/logo/')
      setLogoUrl(null)
      instituicaoAlterada()
    } catch (err) {
      avisar('erro', mensagemErro(err))
    }
  }

  if (!form) return <p className="text-sm text-[var(--text-muted)]">Carregando…</p>

  return (
    <form onSubmit={salvar} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-4">
      <LinkPortal />
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Dados da instituição</h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Aparecem no portal de transparência, no menu do painel, nos recibos, nos relatórios e na prévia ao compartilhar campanhas.
        </p>
      </div>

      <div className="flex items-center gap-4">
        {logoUrl
          ? <img src={logoUrl} alt="Logo atual" className="h-16 w-16 object-contain rounded-lg border border-[var(--border)] bg-white" />
          : <div className="h-16 w-16 rounded-lg border border-dashed border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">Sem logo</div>}
        <div className="space-y-1">
          <label htmlFor="inst-logo" className="block text-xs font-medium text-[var(--text-secondary)]">Logo (JPG, PNG ou WEBP até 5 MB)</label>
          <input id="inst-logo" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => enviarLogo(e.target.files?.[0])} className="block text-xs text-[var(--text-secondary)]" />
          {logoUrl && <button type="button" onClick={removerLogo} className="text-xs text-red-600 hover:underline">Remover logo</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAMPOS.map(([campo, rotulo, extra]) => (
          <div key={campo} className={campo === 'endereco' || campo === 'nome' ? 'sm:col-span-2' : ''}>
            <label htmlFor={`inst-${campo}`} className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{rotulo}</label>
            <input
              id={`inst-${campo}`} className={inputCls} value={form[campo]} {...extra}
              aria-invalid={Boolean(erros[campo])} aria-describedby={erros[campo] ? `inst-${campo}-erro` : undefined}
              onChange={(e) => setForm((f) => ({ ...f, [campo]: e.target.value }))}
            />
            {erros[campo] && <p id={`inst-${campo}-erro`} className="text-xs text-red-600 mt-1">{erros[campo]}</p>}
          </div>
        ))}
        <div className="sm:col-span-2">
          <label htmlFor="inst-descricao" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Descrição curta (aparece no topo do portal)</label>
          <textarea
            id="inst-descricao" rows={2} maxLength={300} className={`${inputCls} resize-none`} value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: '#0f4c5c' }}>
          <Save size={14} aria-hidden="true" /> {salvando ? 'Salvando...' : 'Salvar dados'}
        </button>
      </div>
    </form>
  )
}
