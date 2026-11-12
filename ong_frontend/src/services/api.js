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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const rotaDeAuth = original?.url?.startsWith('/auth/')
    if (error.response?.status === 401 && !original._retry && !rotaDeAuth) {
      original._retry = true
      const refresh = localStorage.getItem('ong_refresh')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/auth/token/refresh/', { refresh })
          localStorage.setItem('ong_access', data.access)
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch { /* refresh expirado */ }
      }
      localStorage.removeItem('ong_access')
      localStorage.removeItem('ong_refresh')
      if (window.location.pathname.startsWith('/admin')) window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Dashboard
export const getDashboardResumo    = () => api.get('/dashboard/resumo/')
export const getGraficoMensal      = () => api.get('/dashboard/grafico-mensal/')
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
export const getApoiadores         = () => api.get('/apoiadores/')
export const criarApoiador         = (data) => api.post('/apoiadores/', data)
export const atualizarApoiador     = (id, data) => api.put(`/apoiadores/${id}/`, data)
export const excluirApoiador       = (id) => api.delete(`/apoiadores/${id}/`)

// Campanhas
export const getCampanhas          = () => api.get('/campanhas/')
export const criarCampanha         = (data) => api.post('/campanhas/', data)
export const atualizarCampanha     = (id, data) => api.put(`/campanhas/${id}/`, data)
export const excluirCampanha       = (id) => api.delete(`/campanhas/${id}/`)

// Doações
export const getDoacoes            = () => api.get('/doacoes/')
export const criarDoacao           = (data) => api.post('/doacoes/', data)
export const atualizarDoacao       = (id, data) => api.put(`/doacoes/${id}/`, data)
export const excluirDoacao         = (id) => api.delete(`/doacoes/${id}/`)

// Despesas
export const getDespesas             = () => api.get('/despesas/')
export const criarDespesa            = (fd) => api.post('/despesas/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const atualizarDespesa        = (id, fd) => api.put(`/despesas/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
export const excluirDespesa          = (id) => api.delete(`/despesas/${id}/`)
export const removerAnexoDespesa     = (despesaId, anexoId) => api.delete(`/despesas/${despesaId}/anexos/${anexoId}/`)
export const getDespesasResumo       = () => api.get('/despesas/resumo/')
export const getDespesasPorCategoria = () => api.get('/despesas/por-categoria/')

// Comunicados
export const getComunicados        = () => api.get('/comunicados/')
export const criarComunicado       = (data) => api.post('/comunicados/', data)
export const atualizarComunicado   = (id, data) => api.put(`/comunicados/${id}/`, data)
export const excluirComunicado     = (id) => api.delete(`/comunicados/${id}/`)

// Relatórios (download CSV com token no header)
export function downloadRelatorio(tipo) {
  const token = localStorage.getItem('ong_access')
  return fetch(`/api/relatorios/${tipo}/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export default api
