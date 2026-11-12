import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { FaWhatsapp, FaInstagram, FaFacebook, FaLinkedin, FaTiktok } from 'react-icons/fa'
import { MdEmail } from 'react-icons/md'
import { qrComoArquivo } from './QrCodePix'
import { formatBRL } from '../utils/formatos'

/** Botões de compartilhamento: compartilham /c/<id>/, que gera a prévia (Open Graph) e leva à página da campanha. */
export default function CompartilharCampanha({ campanha, idQr }) {
  const [aviso, setAviso] = useState(null)
  const link = `${window.location.origin}/c/${campanha.id}/`
  const texto = `Apoie a campanha "${campanha.titulo}"! Já arrecadamos ${formatBRL(campanha.valor_arrecadado)} de ${formatBRL(campanha.meta_valor)}. Doe via PIX:`
  const textoCompleto = `${texto} ${link}`
  const t = encodeURIComponent(texto)
  const tc = encodeURIComponent(textoCompleto)
  const u = encodeURIComponent(link)

  function abrirPopup(url) {
    window.open(url, '_blank', 'noopener,noreferrer,width=640,height=640')
  }

  // Instagram e TikTok não têm URL de compartilhamento na web: usa o compartilhamento nativo
  // do aparelho (com a imagem do QR Code) e, sem suporte, copia o texto e abre a rede.
  async function compartilharSemUrl(nome, siteUrl) {
    try {
      const arquivo = idQr ? await qrComoArquivo(idQr, 'pix-campanha.png') : null
      const dados = arquivo ? { title: campanha.titulo, text: textoCompleto, files: [arquivo] } : { title: campanha.titulo, text: textoCompleto }
      if (navigator.canShare?.(dados)) {
        await navigator.share(dados)
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
    { label: 'WhatsApp', Icon: FaWhatsapp, onClick: () => abrirPopup(`https://wa.me/?text=${tc}`) },
    { label: 'Instagram', Icon: FaInstagram, onClick: () => compartilharSemUrl('Instagram', 'https://www.instagram.com/') },
    { label: 'Facebook', Icon: FaFacebook, onClick: () => abrirPopup(`https://www.facebook.com/sharer/sharer.php?u=${u}&quote=${t}`) },
    { label: 'LinkedIn', Icon: FaLinkedin, onClick: () => abrirPopup(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`) },
    { label: 'E-mail', Icon: MdEmail, onClick: () => { window.location.href = `mailto:?subject=${encodeURIComponent(`Apoie a campanha: ${campanha.titulo}`)}&body=${tc}` } },
    { label: 'TikTok', Icon: FaTiktok, onClick: () => compartilharSemUrl('TikTok', 'https://www.tiktok.com/') },
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
        <Share2 size={14} className="text-[var(--text-muted)]" aria-hidden="true" />
        Compartilhar campanha
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {redes.map(({ label, Icon, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Icon size={15} className="flex-shrink-0" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      {aviso && (
        <p role="status" className="mt-3 text-xs text-[var(--text-secondary)] bg-[var(--bg-card-alt)] border border-[var(--border)] rounded-lg px-3 py-2">
          {aviso}
        </p>
      )}
    </div>
  )
}
