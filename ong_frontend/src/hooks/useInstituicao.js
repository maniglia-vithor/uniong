import { useEffect, useState } from 'react'
import axios from 'axios'

export const NOME_PADRAO = 'Nossa organização'
const EVENTO = 'instituicao-alterada'

let cache = null
let promessa = null

function carregar(forcar = false) {
  if (forcar) { cache = null; promessa = null }
  if (!promessa) {
    promessa = axios.get('/api/public/instituicao/')
      .then(({ data }) => { cache = data; return data })
      .catch(() => { promessa = null; return null })
  }
  return promessa
}

/** Avisa as telas abertas (logo e nome no menu, portal) que os dados da instituição mudaram. */
export function instituicaoAlterada() {
  carregar(true).then(() => window.dispatchEvent(new Event(EVENTO)))
}

/** Dados públicos da instituição (nome, contatos, logo), buscados uma vez e compartilhados. */
export default function useInstituicao() {
  const [dados, setDados] = useState(cache)
  useEffect(() => {
    let ativo = true
    const atualizar = () => carregar().then((d) => { if (ativo && d) setDados(d) })
    atualizar()
    window.addEventListener(EVENTO, atualizar)
    return () => { ativo = false; window.removeEventListener(EVENTO, atualizar) }
  }, [])
  const nome = dados?.nome || NOME_PADRAO
  return { ...(dados ?? {}), nome, configurada: Boolean(dados?.nome) }
}
