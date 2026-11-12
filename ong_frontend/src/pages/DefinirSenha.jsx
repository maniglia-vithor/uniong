import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'

const TEXTOS = {
  convite: {
    titulo: 'Defina sua senha',
    sub: 'Você foi convidado para o painel administrativo. Escolha uma senha para ativar o acesso.',
    url: '/api/auth/ativar-convite/',
    sucesso: 'Acesso ativado! Entre com o seu e-mail e a senha que acabou de criar.',
  },
  redefinir: {
    titulo: 'Nova senha',
    sub: 'Escolha uma nova senha para o seu acesso ao painel.',
    url: '/api/auth/redefinir-senha/',
    sucesso: 'Senha alterada! Entre com a nova senha.',
  },
}

export default function DefinirSenha({ modo = 'convite' }) {
  const { uid, token } = useParams()
  const textos = TEXTOS[modo]
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [concluido, setConcluido] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (senha !== confirmacao) {
      setErro('As senhas não conferem.')
      return
    }
    setEnviando(true)
    setErro(null)
    try {
      await axios.post(textos.url, { uid, token, senha })
      setConcluido(true)
    } catch (err) {
      const dados = err.response?.data
      setErro(dados?.senha?.join(' ') ?? dados?.erro ?? 'Não foi possível concluir. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const campo = 'w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-[#0f4c5c] focus:ring-2 focus:ring-[#0f4c5c]/10 bg-white text-slate-800'

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f8fafc' }}>
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
        <div className="h-1 rounded-full mb-6" style={{ background: 'linear-gradient(to right, #0f4c5c, #f97316)' }} />
        <h1 className="text-xl font-bold text-slate-800">{textos.titulo}</h1>
        {concluido ? (
          <>
            <p role="status" className="text-sm text-emerald-700 mt-3">{textos.sucesso}</p>
            <Link to="/login" className="inline-block mt-5 text-sm font-semibold" style={{ color: '#0f4c5c' }}>Ir para o login</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            <p className="text-sm text-slate-500">{textos.sub}</p>
            <div>
              <label htmlFor="senha" className="block text-xs font-semibold mb-1.5" style={{ color: '#0f4c5c' }}>Senha</label>
              <input id="senha" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} className={campo} aria-describedby="dica-senha" />
              <p id="dica-senha" className="text-[11px] text-slate-500 mt-1">Mínimo de 8 caracteres, sem ser só números nem parecida com o seu nome ou e-mail.</p>
            </div>
            <div>
              <label htmlFor="confirmacao" className="block text-xs font-semibold mb-1.5" style={{ color: '#0f4c5c' }}>Confirme a senha</label>
              <input id="confirmacao" type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required className={campo} />
            </div>
            {erro && <div role="alert" className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-xs text-red-600 font-medium">{erro}</div>}
            <button type="submit" disabled={enviando} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#0f4c5c' }}>
              {enviando ? 'Salvando...' : 'Salvar senha'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
