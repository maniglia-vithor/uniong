/** Logo da instituição; sem logo cadastrado, mostra a inicial do nome. */
export default function LogoInstituicao({ instituicao, className = 'w-9 h-9', claro = false }) {
  if (instituicao.logo_url) {
    return <img src={instituicao.logo_url} alt={`Logo de ${instituicao.nome}`} className={`${className} rounded-lg object-contain flex-shrink-0 bg-white`} />
  }
  return (
    <div
      aria-hidden="true"
      className={`${className} rounded-lg flex items-center justify-center font-bold flex-shrink-0`}
      style={claro ? { backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' } : { backgroundColor: '#0f4c5c', color: '#fff' }}
    >
      {instituicao.nome.trim().charAt(0).toUpperCase()}
    </div>
  )
}
