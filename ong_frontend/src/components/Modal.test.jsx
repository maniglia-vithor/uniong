import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import Modal from './Modal'

function Exemplo() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      <button onClick={() => setAberto(true)}>Abrir</button>
      {aberto && (
        <Modal titulo="Novo registro" onFechar={() => setAberto(false)}>
          <input aria-label="Nome" />
          <button>Salvar</button>
        </Modal>
      )}
    </>
  )
}

describe('Modal', () => {
  it('é um diálogo nomeado pelo título, com foco dentro e preso nele', () => {
    render(<Exemplo />)
    fireEvent.click(screen.getByText('Abrir'))
    const dialogo = screen.getByRole('dialog', { name: 'Novo registro' })
    expect(dialogo).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByLabelText('Nome')).toHaveFocus()

    // Tab no último elemento volta ao primeiro; Shift+Tab no primeiro vai ao último.
    screen.getByText('Salvar').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Salvar')).toHaveFocus()
  })

  it('fecha com Esc e devolve o foco a quem abriu', () => {
    render(<Exemplo />)
    const abrir = screen.getByText('Abrir')
    abrir.focus()
    fireEvent.click(abrir)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(abrir).toHaveFocus()
  })
})
