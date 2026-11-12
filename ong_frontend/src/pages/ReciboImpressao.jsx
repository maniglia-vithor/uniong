import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, Printer } from 'lucide-react'
import { emitirRecibo, enviarRecibo } from '../services/api'
import { formatBRL, formatData, mensagemErro } from '../utils/formatos'

/** Recibo de doação em HTML imprimível (o navegador salva como PDF), no mesmo padrão da prestação de contas. */
export default function ReciboImpressao() {
  const { id } = useParams()
  const [dados, setDados] = useState(null)
  const [erro, setErro] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    emitirRecibo(id)
      .then(({ data }) => setDados(data))
      .catch((err) => setErro(mensagemErro(err, 'Não foi possível emitir o recibo.')))
  }, [id])

  async function enviar() {
    setEnviando(true)
    setAviso(null)
    try {
      const { data } = await enviarRecibo(id)
      setDados(data)
      setAviso({ ok: true, texto: data.mensagem })
    } catch (err) {
      setAviso({ ok: false, texto: mensagemErro(err, 'Não foi possível enviar o recibo.') })
    } finally {
      setEnviando(false)
    }
  }

  if (erro) {
    return (
      <div className="p-8 space-y-3">
        <p className="text-red-600" role="alert">{erro}</p>
        <Link to="/admin/doacoes" className="text-sm font-medium" style={{ color: '#0f4c5c' }}>Voltar às doações</Link>
      </div>
    )
  }
  if (!dados) return <p className="p-8 text-slate-500">Emitindo recibo…</p>

  const { instituicao: inst, doacao: d, doador } = dados
  const nomeInst = inst.nome || 'A organização'

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-200 bg-slate-50">
        <Link to="/admin/doacoes" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#0f4c5c' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar às doações
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {doador.email && (
            <button onClick={enviar} disabled={enviando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-60"
              style={{ borderColor: '#0f4c5c', color: '#0f4c5c' }}>
              <Mail size={15} aria-hidden="true" /> {enviando ? 'Enviando...' : `Enviar para ${doador.email}`}
            </button>
          )}
          <button onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#0f4c5c' }}>
            <Printer size={15} aria-hidden="true" /> Imprimir / salvar em PDF
          </button>
        </div>
      </div>
      {aviso && (
        <p role={aviso.ok ? 'status' : 'alert'} className={`no-print px-6 py-2 text-sm ${aviso.ok ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>{aviso.texto}</p>
      )}

      <main className="max-w-2xl mx-auto px-8 py-10 space-y-8">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            {inst.logo_url && <img src={inst.logo_url} alt="" className="h-14 w-14 object-contain" />}
            <div>
              <p className="font-bold text-lg">{nomeInst}</p>
              <p className="text-xs text-slate-600">
                {[inst.cnpj_formatado && `CNPJ ${inst.cnpj_formatado}`, inst.endereco].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-slate-600">{[inst.email, inst.telefone, inst.site].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">Recibo nº</p>
            <p className="font-bold text-lg">{dados.numero_formatado}</p>
          </div>
        </header>

        <section className="space-y-4">
          <h1 className="text-2xl font-bold text-center">Recibo de doação</h1>
          {d.tipo === 'bens' ? (
            <p className="text-base leading-relaxed">
              {nomeInst} declara que recebeu de <strong>{doador.nome}</strong>
              {doador.documento && <> (CPF/CNPJ {doador.documento})</>}, em {formatData(d.data)}, a doação dos seguintes bens:{' '}
              <strong>{d.descricao_bens}</strong>
              {d.valor_estimado ? <>, com valor estimado de {formatBRL(d.valor_estimado)}</> : null}
              {d.campanha && <>, destinada à campanha “{d.campanha}”</>}.
            </p>
          ) : (
            <p className="text-base leading-relaxed">
              {nomeInst} declara que recebeu de <strong>{doador.nome}</strong>
              {doador.documento && <> (CPF/CNPJ {doador.documento})</>} a importância de{' '}
              <strong>{formatBRL(d.valor)}</strong> ({d.valor_extenso}), em {formatData(d.data)}
              {d.forma_pagamento && <>, por {d.forma_pagamento}</>}
              {d.campanha && <>, destinada à campanha “{d.campanha}”</>}, a título de doação.
            </p>
          )}
          <p className="text-base">Agradecemos a sua contribuição.</p>
        </section>

        <section className="pt-16 text-center">
          <div className="mx-auto w-72 border-t border-slate-500 pt-1 text-sm">{nomeInst}</div>
        </section>

        <footer className="text-xs text-slate-500 border-t border-slate-300 pt-3 flex flex-wrap justify-between gap-2">
          <span>Emitido em {new Date(dados.emitido_em).toLocaleString('pt-BR')}{dados.enviado_em && ` · enviado para ${dados.enviado_para}`}</span>
          <span>Gerado com UniONG</span>
        </footer>
      </main>
    </div>
  )
}
