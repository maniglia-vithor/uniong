import { useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState(null)
  const [erro, setErro] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setEnviando(true)
    setErro(null)
    try {
      const { data } = await axios.post('/api/auth/recuperar-senha/', { email })
      setMensagem(data.mensagem)
    } catch (err) {
      setErro(err.response?.status === 429
        ? 'Muitas tentativas. Aguarde um minuto e tente de novo.'
        : 'Não foi possível enviar agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="h-1 rounded-full mb-6" style={{ background: 'linear-gradient(to right, #0f4c5c, #f97316)' }} />
        <h1 className="text-xl font-bold text-slate-800">Recuperar senha</h1>
        {mensagem ? (
          <p role="status" className="text-sm text-emerald-700 mt-3">{mensagem} Confira também a caixa de spam.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">Informe o e-mail do seu acesso ao painel. Enviaremos um link para criar uma nova senha.</p>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5" style={{ color: '#0f4c5c' }}>E-mail</label>
              <input
                id="email" type="email" autoComplete="email" value={email} required
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/10 bg-white text-slate-800"
              />
            </div>
            {erro && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600 font-medium">{erro}</div>}
            <button type="submit" disabled={enviando} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#0f4c5c' }}>
              {enviando ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        )}
        <Link to="/login" className="inline-block mt-5 text-sm font-semibold" style={{ color: '#0f4c5c' }}>Voltar ao login</Link>
      </div>
    </main>
  )
}
