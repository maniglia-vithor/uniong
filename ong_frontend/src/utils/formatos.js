export function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor ?? 0))
}

export function formatData(iso) {
  if (!iso) return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatCelular(digitos) {
  const d = String(digitos ?? '').replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return d || '—'
}

// Extrai a primeira mensagem legível de um erro do DRF ({erro}, {detail}, {campo: [msg]}).
export function mensagemErro(err, padrao = 'Erro ao salvar. Verifique os dados.') {
  const dados = err?.response?.data
  if (!dados || typeof dados !== 'object') return padrao
  if (typeof dados.erro === 'string') return dados.erro
  if (typeof dados.detail === 'string') return dados.detail
  for (const valor of Object.values(dados)) {
    if (Array.isArray(valor) && typeof valor[0] === 'string') return valor[0]
    if (typeof valor === 'string') return valor
  }
  return padrao
}

export const NOMES_MODELOS = {
  Apoiador: 'Membro',
  Campanha: 'Campanha',
  Doacao: 'Doação',
  Despesa: 'Despesa',
  ConfiguracaoPix: 'Chave PIX',
  ConfiguracaoInstituicao: 'Instituição',
}

export function formatarMomento(iso) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}
