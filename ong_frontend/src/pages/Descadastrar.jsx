import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'

/** Página aberta pelo link dos e-mails de comunicados; o descadastro só acontece ao confirmar. */
export default function Descadastrar() {
  const { token } = useParams()
  const url = `/api/public/descadastrar/${token}/`
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    axios.get(url).then(({ data }) => setDados(data)).catch(() => setErro('Link de descadastro inválido.'))
  }, [url])

  async function confirmar() {
    setEnviando(true)
    try {
      const { data } = await axios.post(url)
      setDados(data)
    } catch {
      setErro('Não foi possível concluir. Tente novamente em alguns minutos.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200 space-y-3">
        <h1 className="text-xl font-bold text-slate-800">Comunicados por e-mail</h1>
        {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
        {!erro && !dados && <p className="text-sm text-slate-500">Carregando…</p>}
        {dados && (dados.recebe_comunicados ? (
          <>
            <p className="text-sm text-slate-600">{dados.nome}, deseja parar de receber os comunicados da organização por e-mail?</p>
            <button onClick={confirmar} disabled={enviando} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#0f4c5c' }}>
              {enviando ? 'Salvando...' : 'Sim, não quero mais receber'}
            </button>
          </>
        ) : (
          <p role="status" className="text-sm text-emerald-700">Pronto, {dados.nome}: você não receberá mais comunicados por e-mail. Para voltar a receber, fale com a organização.</p>
        ))}
      </div>
    </main>
  )
}
