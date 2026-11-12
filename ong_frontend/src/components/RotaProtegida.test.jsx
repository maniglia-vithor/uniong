import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RotaProtegida from './RotaProtegida'
import { useAuth } from '../context/AuthContext'

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }))

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<p>Tela de login</p>} />
        <Route element={<RotaProtegida />}>
          <Route path="/admin" element={<p>Painel</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RotaProtegida', () => {
  it('mostra o carregamento enquanto confere a sessão', () => {
    useAuth.mockReturnValue({ autenticado: false, carregando: true })
    renderizar()
    expect(screen.queryByText('Painel')).not.toBeInTheDocument()
    expect(screen.queryByText('Tela de login')).not.toBeInTheDocument()
  })

  it('redireciona ao login quem não está autenticado', () => {
    useAuth.mockReturnValue({ autenticado: false, carregando: false })
    renderizar()
    expect(screen.getByText('Tela de login')).toBeInTheDocument()
  })

  it('libera o painel para quem está autenticado', () => {
    useAuth.mockReturnValue({ autenticado: true, carregando: false })
    renderizar()
    expect(screen.getByText('Painel')).toBeInTheDocument()
  })
})
