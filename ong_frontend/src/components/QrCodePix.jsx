import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { Copy, Check } from 'lucide-react'
import { gerarPayloadPix } from '../utils/pix'

/** Converte o canvas do QR Code (pelo id) num arquivo PNG, para compartilhar a imagem. */
export function qrComoArquivo(idCanvas, nomeArquivo = 'pix.png') {
  const canvas = document.getElementById(idCanvas)
  if (!canvas) return Promise.resolve(null)
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? new File([blob], nomeArquivo, { type: 'image/png' }) : null), 'image/png')
  })
}

/** QR Code PIX "copia e cola" gerado localmente, com botão de copiar. Sem chave cadastrada, mostra um aviso. */
export default function QrCodePix({ pix, txid, valor = null, descricao, idCanvas = 'qr-pix' }) {
  const [copiado, setCopiado] = useState(false)
  if (!pix?.chave) {
    return (
      <p className="text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-lg p-4">
        A instituição ainda não cadastrou uma chave PIX para receber doações.
      </p>
    )
  }
  const payload = gerarPayloadPix({ chave: pix.chave, nome: pix.nome_recebedor, cidade: pix.cidade, txid, valor })

  async function copiar() {
    try {
      await navigator.clipboard.writeText(payload)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch { /* área de transferência indisponível */ }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 border border-[var(--border)] rounded-lg p-4">
      <div className="bg-white p-2 rounded-md border border-[var(--border)] flex-shrink-0">
        <QRCodeCanvas id={idCanvas} value={payload} size={140} level="M" marginSize={1}
          title="QR Code PIX" role="img" aria-label="QR Code PIX para doação" />
      </div>
      <div className="space-y-2 min-w-0">
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{descricao}</p>
        <p className="text-[11px] text-[var(--text-muted)] break-all">Chave: {pix.chave}</p>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          {copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copiado ? 'Código copiado' : 'Copiar código PIX'}
        </button>
      </div>
    </div>
  )
}
