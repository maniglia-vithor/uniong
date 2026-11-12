import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Receipt } from 'lucide-react'
import BadgeStatus from '../components/BadgeStatus'
import QrCodePix from '../components/QrCodePix'
import CompartilharCampanha from '../components/CompartilharCampanha'
import ResumoCampanha from '../components/ResumoCampanha'
import ListaDespesasPublicas from '../components/ListaDespesasPublicas'
import { formatBRL } from '../utils/formatos'

export default function CampanhaPublica() {
  const { id } = useParams()
  const [campanha, setCampanha] = useState(null)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    axios.get(`/api/public/campanhas/${id}/`)
      .then(({ data }) => {
        setCampanha(data)
        document.title = `${data.titulo} — Portal de Transparência`
      })
      .catch((err) => setErro(err.response?.status === 404 ? 'Campanha não encontrada.' : 'Não foi possível carregar a campanha.'))
  }, [id])

  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link to="/transparencia" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--marca-texto)' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Portal de transparência
        </Link>

        {erro && (
          <p role="alert" className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-6 text-sm text-[var(--text-secondary)]">{erro}</p>
        )}
        {!erro && !campanha && <p className="text-sm text-[var(--text-muted)]">Carregando…</p>}

        {campanha && (
          <>
            <article className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
              {campanha.imagem_url && (
                <img src={campanha.imagem_url} alt="" className="w-full max-h-72 object-cover" />
              )}
              <div className="p-6 space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <h1 className="text-2xl font-bold text-[var(--text-primary)]">{campanha.titulo}</h1>
                  <BadgeStatus status={campanha.status_efetivo} />
                </header>
                {campanha.descricao && (
                  <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">{campanha.descricao}</p>
                )}
                <ResumoCampanha campanha={campanha} />
              </div>
            </article>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campanha.status_efetivo === 'ativa' ? (
                <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-3">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Doar via PIX</h2>
                  <QrCodePix
                    pix={campanha.pix}
                    txid={`CAMPANHA${campanha.id}`}
                    idCanvas="qr-campanha-pagina"
                    descricao="Escaneie o QR Code com o aplicativo do seu banco ou use o PIX copia e cola."
                  />
                </section>
              ) : (
                <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6">
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">Campanha encerrada</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-2">Esta campanha não recebe mais doações. Obrigado a todos que contribuíram!</p>
                </section>
              )}
              <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6">
                <CompartilharCampanha campanha={campanha} idQr={campanha.status_efetivo === 'ativa' ? 'qr-campanha-pagina' : null} />
              </section>
            </div>

            <section className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 space-y-3">
              <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Receipt size={16} style={{ color: 'var(--destaque-texto)' }} aria-hidden="true" />
                Prestação de contas da campanha
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Despesas pagas com recursos desta campanha: {formatBRL(campanha.valor_gasto)}. Saldo: {formatBRL(campanha.saldo)}.
              </p>
              <ListaDespesasPublicas lista={campanha.despesas} vazio="Ainda não há despesas pagas vinculadas a esta campanha." />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
