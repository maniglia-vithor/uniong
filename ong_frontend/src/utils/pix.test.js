import { describe, expect, it } from 'vitest'
import { crc16, gerarPayloadPix } from './pix'

// Exemplo do Manual de Padrões para Iniciação do Pix (Banco Central), cujo CRC é 1D3D.
const EXEMPLO_BCB =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000' +
  '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304'

function campos(payload) {
  const lidos = {}
  let i = 0
  while (i < payload.length - 4) {
    const id = payload.slice(i, i + 2)
    const tamanho = Number(payload.slice(i + 2, i + 4))
    lidos[id] = payload.slice(i + 4, i + 4 + tamanho)
    i += 4 + tamanho
    if (id === '63') break
  }
  return lidos
}

const BASE = { chave: '123e4567-e12b-12d1-a456-426655440000', nome: 'Instituto Exemplo', cidade: 'São Paulo' }

describe('PIX copia e cola', () => {
  it('calcula o CRC16 do exemplo oficial do Banco Central', () => {
    expect(crc16(EXEMPLO_BCB)).toBe('1D3D')
  })

  it('termina com o CRC do próprio payload', () => {
    const payload = gerarPayloadPix(BASE)
    expect(payload.slice(-8, -4)).toBe('6304')
    expect(payload.slice(-4)).toBe(crc16(payload.slice(0, -4)))
  })

  it('inclui o campo de valor (54) com duas casas só quando há valor positivo', () => {
    expect(campos(gerarPayloadPix({ ...BASE, valor: 25.5 }))['54']).toBe('25.50')
    expect(campos(gerarPayloadPix({ ...BASE, valor: '10' }))['54']).toBe('10.00')
    expect(campos(gerarPayloadPix(BASE))['54']).toBeUndefined()
    expect(campos(gerarPayloadPix({ ...BASE, valor: 0 }))['54']).toBeUndefined()
  })

  it('usa o txid alfanumérico, limitado a 25 caracteres, ou *** quando ausente', () => {
    expect(campos(gerarPayloadPix({ ...BASE, txid: 'CAMPANHA-12' }))['62']).toBe('0510CAMPANHA12')
    const longo = campos(gerarPayloadPix({ ...BASE, txid: 'A'.repeat(40) }))['62']
    expect(longo).toBe('0525' + 'A'.repeat(25))
    expect(campos(gerarPayloadPix(BASE))['62']).toBe('0503***')
  })

  it('remove acentos e limita nome (25) e cidade (15)', () => {
    const lidos = campos(gerarPayloadPix({
      ...BASE, nome: 'Associação Beneficente São João da Esperança', cidade: 'São José dos Campos',
    }))
    expect(lidos['59']).toBe('ASSOCIACAO BENEFICENTE SA')
    expect(lidos['59']).toHaveLength(25)
    expect(lidos['60']).toBe('SAO JOSE DOS CA')
    expect(lidos['60']).toHaveLength(15)
  })
})
