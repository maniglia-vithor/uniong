import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Paginacao from './Paginacao'

describe('Paginacao', () => {
  it('mostra só a contagem quando cabe em uma página', () => {
    render(<Paginacao pagina={1} total={3} tamanhoPagina={20} onMudar={() => {}} />)
    expect(screen.getByText('3 registros')).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('não mostra nada sem registros', () => {
    const { container } = render(<Paginacao pagina={1} total={0} tamanhoPagina={20} onMudar={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra o intervalo e navega entre páginas', () => {
    const onMudar = vi.fn()
    render(<Paginacao pagina={2} total={45} tamanhoPagina={20} onMudar={onMudar} />)
    expect(screen.getByText('21–40 de 45')).toBeInTheDocument()
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
    expect(onMudar.mock.calls).toEqual([[3], [1]])
  })

  it('desabilita os botões nas pontas', () => {
    const { rerender } = render(<Paginacao pagina={1} total={45} tamanhoPagina={20} onMudar={() => {}} />)
    expect(screen.getByRole('button', { name: 'Página anterior' })).toBeDisabled()
    rerender(<Paginacao pagina={3} total={45} tamanhoPagina={20} onMudar={() => {}} />)
    expect(screen.getByText('41–45 de 45')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled()
  })
})
