import { describe, expect, it } from 'vitest'
import { formatBRL, formatData } from './formatos'

// O Intl usa espaço não separável entre "R$" e o número.
const semNbsp = (texto) => texto.replace(/ /g, ' ')

describe('formatBRL', () => {
  it('formata em reais com vírgula decimal e ponto de milhar', () => {
    expect(semNbsp(formatBRL(1234.5))).toBe('R$ 1.234,50')
    expect(semNbsp(formatBRL('99.9'))).toBe('R$ 99,90')
  })

  it('trata vazio como zero', () => {
    expect(semNbsp(formatBRL(null))).toBe('R$ 0,00')
    expect(semNbsp(formatBRL(undefined))).toBe('R$ 0,00')
  })
})

describe('formatData', () => {
  it('converte AAAA-MM-DD em dd/mm/aaaa sem depender do fuso', () => {
    expect(formatData('2026-01-05')).toBe('05/01/2026')
    expect(formatData('2026-12-31T23:30:00-03:00')).toBe('31/12/2026')
  })

  it('mostra travessão quando não há data', () => {
    expect(formatData(null)).toBe('—')
    expect(formatData('')).toBe('—')
  })
})
