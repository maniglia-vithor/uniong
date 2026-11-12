import { Mail, Phone, MapPin, Globe } from 'lucide-react'
import { FaInstagram, FaFacebook, FaLinkedin, FaYoutube } from 'react-icons/fa'

const REDES = [
  ['instagram', 'Instagram', FaInstagram],
  ['facebook', 'Facebook', FaFacebook],
  ['linkedin', 'LinkedIn', FaLinkedin],
  ['youtube', 'YouTube', FaYoutube],
]

function formatTelefone(t) {
  if (!t) return ''
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`
  return t
}

/** Contatos e redes da instituição (portal público). */
export default function RodapeInstituicao({ instituicao }) {
  const contatos = [
    instituicao.email && { icone: Mail, texto: instituicao.email, href: `mailto:${instituicao.email}` },
    instituicao.telefone && { icone: Phone, texto: formatTelefone(instituicao.telefone), href: `tel:+55${instituicao.telefone}` },
    instituicao.site && { icone: Globe, texto: instituicao.site.replace(/^https?:\/\//, ''), href: instituicao.site },
    instituicao.endereco && { icone: MapPin, texto: instituicao.endereco },
  ].filter(Boolean)
  const redes = REDES.filter(([campo]) => instituicao[campo])
  if (!contatos.length && !redes.length && !instituicao.cnpj_formatado) return null
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {contatos.map(({ icone: Icone, texto, href }) => (
          <li key={texto} className="flex items-center gap-1.5">
            <Icone size={12} aria-hidden="true" />
            {href ? <a href={href} className="hover:underline" target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{texto}</a> : texto}
          </li>
        ))}
        {instituicao.cnpj_formatado && <li>CNPJ {instituicao.cnpj_formatado}</li>}
      </ul>
      {redes.length > 0 && (
        <div className="flex gap-2">
          {redes.map(([campo, rotulo, Icone]) => (
            <a key={campo} href={instituicao[campo]} target="_blank" rel="noreferrer" aria-label={`${rotulo} de ${instituicao.nome}`}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
              <Icone size={15} aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
