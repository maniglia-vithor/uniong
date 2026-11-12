import { useEffect, useId, useRef } from 'react'

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Comportamento acessível de diálogo modal: foco vai para dentro ao abrir, Tab/Shift+Tab ficam presos
 * no diálogo, Esc fecha e, ao fechar, o foco volta ao elemento que abriu.
 * Devolve `ref` (para o painel) e `tituloId` (para aria-labelledby).
 */
export default function useDialogo(onFechar) {
  const ref = useRef(null)
  const tituloId = useId()
  const fecharRef = useRef(onFechar)

  useEffect(() => { fecharRef.current = onFechar }, [onFechar])

  useEffect(() => {
    const anterior = document.activeElement
    const painel = ref.current
    const primeiro = painel?.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea') ?? painel?.querySelector(FOCAVEIS)
    ;(primeiro ?? painel)?.focus()

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        fecharRef.current?.()
        return
      }
      if (e.key !== 'Tab' || !painel) return
      const itens = [...painel.querySelectorAll(FOCAVEIS)].filter((el) => !el.closest('[hidden], [inert]'))
      if (itens.length === 0) { e.preventDefault(); return }
      const [inicio, fim] = [itens[0], itens[itens.length - 1]]
      if (e.shiftKey && (document.activeElement === inicio || !painel.contains(document.activeElement))) {
        e.preventDefault(); fim.focus()
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault(); inicio.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus()
    }
  }, [])

  return { ref, tituloId }
}
