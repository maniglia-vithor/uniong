import { useCallback, useEffect, useState } from 'react'

const TAMANHO_PAGINA = 20

/**
 * Lista paginada no servidor: página, busca (com atraso) e ordenação (?ordering=).
 * `buscar(params)` deve devolver a promessa do axios para um endpoint paginado do DRF.
 */
export default function useListaPaginada(buscar, { ordenacaoInicial = '', filtros = {} } = {}) {
  const [itens, setItens] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [ordenacao, setOrdenacao] = useState(ordenacaoInicial)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [versao, setVersao] = useState(0)
  const chaveFiltros = JSON.stringify(filtros)

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPagina(1)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  useEffect(() => { setPagina(1) }, [chaveFiltros])

  useEffect(() => {
    let ativo = true
    const params = { page: pagina, page_size: TAMANHO_PAGINA, ...JSON.parse(chaveFiltros) }
    if (buscaAplicada) params.search = buscaAplicada
    if (ordenacao) params.ordering = ordenacao
    setCarregando(true)
    setErro(null)
    buscar(params)
      .then(({ data }) => {
        if (!ativo) return
        setItens(data.results ?? data)
        setTotal(data.count ?? (data.results ?? data).length)
      })
      .catch((err) => {
        if (!ativo) return
        if (err.response?.status === 404 && pagina > 1) setPagina(1)
        else setErro('Erro ao carregar os dados. Verifique se o servidor está rodando.')
      })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [buscar, pagina, buscaAplicada, ordenacao, chaveFiltros, versao])

  const recarregar = useCallback(() => setVersao((v) => v + 1), [])

  // Ciclo do cabeçalho: crescente → decrescente → padrão.
  const alternarOrdenacao = useCallback((campo) => {
    setOrdenacao((atual) => {
      if (atual === campo) return `-${campo}`
      if (atual === `-${campo}`) return ordenacaoInicial
      return campo
    })
    setPagina(1)
  }, [ordenacaoInicial])

  const direcao = useCallback((campo) => {
    if (ordenacao === campo) return 'asc'
    if (ordenacao === `-${campo}`) return 'desc'
    return null
  }, [ordenacao])

  return {
    itens, total, pagina, setPagina, tamanhoPagina: TAMANHO_PAGINA,
    busca, setBusca, ordenacao, setOrdenacao, alternarOrdenacao, direcao,
    carregando, erro, recarregar,
  }
}
