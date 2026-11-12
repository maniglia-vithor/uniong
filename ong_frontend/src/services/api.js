import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ong_access')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

const ROTAS_SEM_RENOVACAO = ['/auth/token/', '/auth/token/refresh/', '/auth/google/', '/auth/logout/']

// Uma única renovação por vez: o refresh é rotacionado e o anterior é revogado,
// então requisições simultâneas precisam esperar a mesma renovação.
let renovacaoEmAndamento = null

function renovarAccess() {
  if (!renovacaoEmAndamento) {
    const refresh = localStorage.getItem('ong_refresh')
    renovacaoEmAndamento = (refresh
      ? axios.post('/api/auth/token/refresh/', { refresh }).then(({ data }) => {
          localStorage.setItem('ong_access', data.access)
          if (data.refresh) localStorage.setItem('ong_refresh', data.refresh)
          return data.access
        })
      : Promise.reject(new Error('sem refresh token'))
    ).finally(() => { renovacaoEmAndamento = null })
  }
  return renovacaoEmAndamento
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const semRenovacao = ROTAS_SEM_RENOVACAO.includes(original?.url)
    if (error.response?.status === 401 && original && !original._retry && !semRenovacao) {
      original._retry = true
      try {
        const access = await renovarAccess()
        original.headers.Authorization = `Bearer ${access}`
        return api(original)
      } catch {
        localStorage.removeItem('ong_access')
        localStorage.removeItem('ong_refresh')
        if (window.location.pathname.startsWith('/admin')) window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

// Dashboard
export const getDashboardResumo    = () => api.get('/dashboard/resumo/')
export const getGraficoMensal      = () => api.get('/dashboard/grafico-mensal/')
export const getFluxoMensal        = () => api.get('/dashboard/fluxo-mensal/')
export const getDoacoesRecentes    = () => api.get('/dashboard/doacoes-recentes/')
export const getTopApoiadores      = () => api.get('/dashboard/top-apoiadores/')
export const getCampanhasAtivas    = () => api.get('/dashboard/campanhas-ativas/')

// KPI Detail Panels
export const getKpiDoacoes          = () => api.get('/dashboard/kpi-doacoes/')
export const getKpiDoacoesMes       = () => api.get('/dashboard/kpi-doacoes-mes/')
export const getKpiApoiadoresAtivos = () => api.get('/dashboard/kpi-apoiadores-ativos/')
export const getKpiCampanhasAtivas  = () => api.get('/dashboard/kpi-campanhas-ativas/')
export const getDoacoesPorMes       = (mes) => api.get(`/dashboard/doacoes-por-mes/?mes=${mes}`)

// Apoiadores
export const getApoiadores         = (params) => api.get('/apoiadores/', { params })
export const getApoiadoresOpcoes   = () => api.get('/apoiadores/opcoes/')
export const criarApoiador         = (data) => api.post('/apoiadores/', data)
export const atualizarApoiador     = (id, data) => api.put(`/apoiadores/${id}/`, data)
export const excluirApoiador       = (id) => api.delete(`/apoiadores/${id}/`)

// Campanhas
export const getCampanhas          = (params) => api.get('/campanhas/', { params })
export const getCampanhasOpcoes    = (params) => api.get('/campanhas/opcoes/', { params })
export const getDespesasDaCampanha = (id) => api.get(`/campanhas/${id}/despesas/`)
export const criarCampanha         = (data) => api.post('/campanhas/', data)
export const atualizarCampanha     = (id, data) => api.put(`/campanhas/${id}/`, data)
export const excluirCampanha       = (id) => api.delete(`/campanhas/${id}/`)
export const enviarImagemCampanha  = (id, arquivo) => {
  const fd = new FormData()
  fd.append('imagem', arquivo)
  return api.post(`/campanhas/${id}/imagem/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const encerrarCampanha      = (id) => api.patch(`/campanhas/${id}/`, { status: 'encerrada' })

// Doações
export const getDoacoes            = (params) => api.get('/doacoes/', { params })
export const getDoacoesResumo      = (params) => api.get('/doacoes/resumo/', { params })
export const acaoEmLoteDoacoes     = (ids, acao) => api.post('/doacoes/acao-em-lote/', { ids, acao })
export const criarDoacao           = (data) => api.post('/doacoes/', data)
export const atualizarDoacao       = (id, data) => api.put(`/doacoes/${id}/`, data)
export const excluirDoacao         = (id) => api.delete(`/doacoes/${id}/`)

// Despesas
export const getDespesas             = (params) => api.get('/despesas/', { params })
export const criarDespesa            = (fd) => api.post('/despesas/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const atualizarDespesa        = (id, fd) => api.put(`/despesas/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const excluirDespesa          = (id) => api.delete(`/despesas/${id}/`)
export const removerAnexoDespesa     = (despesaId, anexoId) => api.delete(`/despesas/${despesaId}/anexos/${anexoId}/`)
export const marcarAnexoPublico      = (despesaId, anexoId, publico) => api.patch(`/despesas/${despesaId}/anexos/${anexoId}/`, { publico })
export const baixarAnexoDespesa      = (despesaId, anexoId) => api.get(`/despesas/${despesaId}/anexos/${anexoId}/download/`, { responseType: 'blob' })
export const getDespesasResumo       = () => api.get('/despesas/resumo/')
export const encerrarSerieDespesa    = (id, recorrencia_fim) => api.post(`/despesas/${id}/encerrar-serie/`, recorrencia_fim ? { recorrencia_fim } : {})
export const aplicarValorProximasDespesa = (id) => api.post(`/despesas/${id}/aplicar-valor-proximas/`)
export const getDespesasPorCategoria = () => api.get('/despesas/por-categoria/')

// Histórico (auditoria, só superusuário)
export const getHistorico           = (params) => api.get('/historico/', { params })

// Equipe (superusuário)
export const getEquipe              = (params) => api.get('/equipe/', { params })
export const convidarEquipe         = (data) => api.post('/equipe/convidar/', data)
export const alterarAcessoEquipe    = (id, data) => api.patch(`/equipe/${id}/acesso/`, data)
export const reenviarConviteEquipe  = (id) => api.post(`/equipe/${id}/reenviar-convite/`)

// Comunicados
export const getComunicados        = (params) => api.get('/comunicados/', { params })
export const criarComunicado       = (data) => api.post('/comunicados/', data)
export const atualizarComunicado   = (id, data) => api.put(`/comunicados/${id}/`, data)
export const excluirComunicado     = (id) => api.delete(`/comunicados/${id}/`)

// Relatórios CSV (via axios: usa o token e a renovação automática)
export const downloadRelatorio = (tipo, params) => api.get(`/relatorios/${tipo}/`, { params, responseType: 'blob' })

// Percorre todas as páginas de um endpoint paginado e devolve a lista completa.
export async function buscarTodas(url, params = {}) {
  const itens = []
  let pagina = 1
  for (;;) {
    const { data } = await api.get(url, { params: { ...params, page: pagina, page_size: 500 } })
    if (!Array.isArray(data.results)) return data
    itens.push(...data.results)
    if (!data.next) return itens
    pagina += 1
  }
}

export default api
