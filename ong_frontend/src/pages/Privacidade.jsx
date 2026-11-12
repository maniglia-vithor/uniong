import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

export default function Privacidade() {
  return (
    <div className="min-h-screen bg-[var(--bg-page)]">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Link to="/transparencia" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--marca-texto)' }}>
          <ArrowLeft size={15} aria-hidden="true" /> Voltar ao portal de transparência
        </Link>

        <article className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] shadow-sm p-6 sm:p-8 space-y-5 text-sm text-[var(--text-secondary)] leading-relaxed">
          <header className="flex items-center gap-3">
            <ShieldCheck size={24} style={{ color: 'var(--marca-texto)' }} aria-hidden="true" />
            <h1 className="text-xl font-bold text-[var(--text-primary)]">Política de privacidade</h1>
          </header>

          <p className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
            Texto-base: a organização deve revisá-lo e adaptá-lo à sua realidade antes de publicá-lo.
          </p>

          <section className="space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)]">Quais dados coletamos</h2>
            <p>
              Ao registrar uma intenção de doação pelo portal, coletamos seu nome, e-mail, celular (opcional),
              o valor e a campanha escolhida, além da data e hora em que você aceitou esta política.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)]">Para que usamos</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Identificar e confirmar o pagamento da sua doação;</li>
              <li>Entrar em contato sobre a doação, se necessário;</li>
              <li>Prestar contas, de forma agregada e sem identificar doadores, no portal de transparência.</li>
            </ul>
            <p>Seus dados não são vendidos nem compartilhados com terceiros para fins comerciais.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)]">Por quanto tempo guardamos</h2>
            <p>
              Mantemos os registros de doação enquanto forem necessários para a contabilidade e a prestação de
              contas da organização, conforme a legislação aplicável.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-[var(--text-primary)]">Seus direitos</h2>
            <p>
              Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode pedir acesso, correção
              ou exclusão dos seus dados pessoais. Para isso, entre em contato com a organização pelos canais
              informados no portal. Quando os dados precisarem ser mantidos para a contabilidade, eles serão
              anonimizados.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
