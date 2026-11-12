import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import Modal from '../components/Modal'
import Paginacao from '../components/Paginacao'
import TabelaVazia from '../components/TabelaVazia'
import { Campo, Input, BotaoSubmit, BotaoCancelar } from '../components/CampoForm'
import { CampoBusca } from '../components/CabecalhoOrdenavel'
import useListaPaginada from '../hooks/useListaPaginada'
import { useAuth } from '../context/AuthContext'
import { getEquipe, convidarEquipe, alterarAcessoEquipe, reenviarConviteEquipe } from '../services/api'
import { formatarMomento, mensagemErro } from '../utils/formatos'

const VAZIO = { nome: '', email: '', superusuario: false }

function Situacao({ pessoa }) {
  if (pessoa.convite_pendente) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Convite pendente</span>
  if (!pessoa.is_active) return <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">Desativado</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Ativo</span>
}

export default function Equipe() {
  const { usuario } = useAuth()
  const lista = useListaPaginada(getEquipe)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState(null)

  if (!usuario?.is_superuser) {
    return <p className="text-sm text-[var(--text-muted)]">Apenas administradores gerais podem gerenciar a equipe.</p>
  }

  async function onConvidar(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      await convidarEquipe(form)
      setModal(false)
      setForm(VAZIO)
      setAviso(`Convite enviado para ${form.email}. O link vale por 72 horas.`)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err, 'Não foi possível enviar o convite.'))
    } finally {
      setSalvando(false)
    }
  }

  async function alterar(pessoa, mudancas, pergunta) {
    if (pergunta && !confirm(pergunta)) return
    try {
      await alterarAcessoEquipe(pessoa.id, mudancas)
      lista.recarregar()
    } catch (err) {
      alert(mensagemErro(err))
    }
  }

  async function reenviar(pessoa) {
    try {
      await reenviarConviteEquipe(pessoa.id)
      setAviso(`Convite reenviado para ${pessoa.email}.`)
    } catch (err) {
      alert(mensagemErro(err))
    }
  }

  const botao = 'px-2 py-1 rounded-lg text-[11px] font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Equipe</h1>
          <p className="text-xs text-[var(--text-muted)]">Quem acessa o painel. Operadores gerenciam os cadastros; administradores gerais também gerenciam a equipe e o histórico.</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          style={{ backgroundColor: '#0f4c5c' }}
        >
          <UserPlus size={15} /> Convidar pessoa
        </button>
      </div>

      {aviso && (
        <div role="status" className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-xs text-emerald-700">{aviso}</div>
      )}

      <CampoBusca valor={lista.busca} onMudar={lista.setBusca} placeholder="Buscar por nome ou e-mail" />

      <div className="bg-[var(--bg-card)] rounded-xl shadow-sm border border-[var(--border)]">
        {lista.erro && <p className="text-red-500 text-sm p-4">{lista.erro}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['Nome', 'E-mail', 'Papel', 'Situação', 'Último acesso', 'Ações'].map((t) => (
                  <th key={t} scope="col" className="text-left text-xs font-medium text-[var(--text-muted)] px-5 py-3">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {lista.carregando ? (
                <tr><td colSpan={6} className="text-center py-10 text-[var(--text-muted)]">Carregando...</td></tr>
              ) : lista.itens.length === 0 ? (
                <TabelaVazia />
              ) : lista.itens.map((p) => (
                <tr key={p.id}>
                  <td className="px-5 py-2.5 text-[var(--text-primary)]">{p.nome}{p.id === usuario.id && <span className="text-[var(--text-muted)]"> (você)</span>}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{p.email || '—'}</td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)]">{p.is_superuser ? 'Administrador geral' : 'Operador'}</td>
                  <td className="px-5 py-2.5"><Situacao pessoa={p} /></td>
                  <td className="px-5 py-2.5 text-[var(--text-secondary)] whitespace-nowrap">{p.last_login ? formatarMomento(p.last_login) : 'Nunca'}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {p.convite_pendente ? (
                        <button className={botao} onClick={() => reenviar(p)}>Reenviar convite</button>
                      ) : p.is_active ? (
                        <button className={botao} onClick={() => alterar(p, { is_active: false }, `Desativar o acesso de ${p.nome}?`)}>Desativar</button>
                      ) : (
                        <button className={botao} onClick={() => alterar(p, { is_active: true })}>Reativar</button>
                      )}
                      <button
                        className={botao}
                        onClick={() => alterar(p, { is_superuser: !p.is_superuser },
                          p.is_superuser ? `Tornar ${p.nome} operador?` : `Tornar ${p.nome} administrador geral?`)}
                      >
                        {p.is_superuser ? 'Tornar operador' : 'Tornar administrador'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacao pagina={lista.pagina} total={lista.total} tamanhoPagina={lista.tamanhoPagina} onMudar={lista.setPagina} />
      </div>

      {modal && (
        <Modal titulo="Convidar pessoa para a equipe" onFechar={() => setModal(false)}>
          <form onSubmit={onConvidar} className="space-y-4">
            <Campo label="Nome">
              <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
            </Campo>
            <Campo label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </Campo>
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.superusuario} onChange={(e) => setForm((f) => ({ ...f, superusuario: e.target.checked }))} />
              Administrador geral (gerencia a equipe, o histórico e os dados da instituição)
            </label>
            <p className="text-xs text-[var(--text-muted)]">A pessoa recebe um e-mail com um link para definir a senha, válido por 72 horas. O usuário de acesso é o próprio e-mail.</p>
            <div className="flex gap-3 pt-2">
              <BotaoCancelar onClick={() => setModal(false)} />
              <BotaoSubmit carregando={salvando} label="Enviar convite" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
