// Gera o payload "PIX copia e cola" (BR Code / EMV) definido pelo Banco Central.

function campo(id, valor) {
  return id + String(valor.length).padStart(2, '0') + valor
}

function normalizar(texto, max) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max)
}

function crc16(payload) {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

export function gerarPayloadPix({ chave, nome, cidade, txid = '***' }) {
  const id = txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const payload =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim())) +
    campo('52', '0000') +
    campo('53', '986') +
    campo('58', 'BR') +
    campo('59', normalizar(nome, 25) || 'UNIONG') +
    campo('60', normalizar(cidade, 15) || 'SAO PAULO') +
    campo('62', campo('05', id)) +
    '6304'
  return payload + crc16(payload)
}
