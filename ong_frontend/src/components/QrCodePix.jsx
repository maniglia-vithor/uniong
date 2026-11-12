import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { gerarPayloadPix } from '../utils/pix'

export function urlImagemQr(payload) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(payload)}`
}

/** QR Code PIX "copia e cola" com botão de copiar. Sem chave cadastrada, mostra um aviso. */
export default function QrCodePix({ pix, txid, valor = null, descricao }) {
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
    <div className="flex items-center gap-4 border border-[var(--border)] rounded-lg p-4">
      <img
        src={urlImagemQr(payload)}
        alt="QR Code PIX"
        className="w-[120px] h-[120px] rounded-md border border-[var(--border)] bg-white flex-shrink-0"
      />
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
