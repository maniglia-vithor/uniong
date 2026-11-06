export default function TabelaVazia({ mensagem = 'Nenhum registro encontrado.' }) {
  return (
    <tr>
      <td colSpan={99} className="text-center py-12 text-slate-400 text-sm">{mensagem}</td>
    </tr>
  )
}
