import { describe, it, expect } from 'vitest'
import {
  validateAccountNumber,
  validateAmount,
  validatePaymentCode,
  buildIpsQrString,
  getIpsQrImageUrl,
} from '../ips-qr'

const validConfig = {
  recipientName: 'Srdjan Denic, Beograd',
  accountNumber: '105000000328120183',
  bankCode: '105',
  pib: '',
  model: '97',
  referencePrefix: '11',
}

describe('validateAccountNumber', () => {
  it('prihvata ispravan 18-cifreni racun', () => {
    expect(validateAccountNumber('105000000328120183')).toBeNull()
  })

  it('prihvata racun sa crticama (strip crtica)', () => {
    expect(validateAccountNumber('105-0000003281201-83')).toBeNull()
  })

  it('odbija IBAN format sa RS prefiksom', () => {
    const err = validateAccountNumber('RS35105008123456789012')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('R')
  })

  it('odbija racun sa pogresnim brojem cifara', () => {
    expect(validateAccountNumber('12345')).not.toBeNull()
    expect(validateAccountNumber('1234567890123456789')).not.toBeNull()
  })

  it('odbija racun sa pogresnim kontrolnim brojem', () => {
    // Poslednje 2 cifre su pogresne
    const err = validateAccountNumber('105000000328120100')
    expect(err).not.toBeNull()
    expect(err?.field).toBe('R')
  })
})

describe('validateAmount', () => {
  it('prihvata pozitivan ceo broj', () => {
    expect(validateAmount(1000)).toBeNull()
    expect(validateAmount(1)).toBeNull()
  })

  it('odbija nulu i negativne', () => {
    expect(validateAmount(0)).not.toBeNull()
    expect(validateAmount(-100)).not.toBeNull()
  })

  it('odbija decimalne vrednosti', () => {
    expect(validateAmount(10.5)).not.toBeNull()
  })
})

describe('validatePaymentCode', () => {
  it('prihvata 3 cifre', () => {
    expect(validatePaymentCode('289')).toBeNull()
    expect(validatePaymentCode('220')).toBeNull()
    expect(validatePaymentCode('000')).toBeNull()
  })

  it('odbija manje od 3 cifre', () => {
    expect(validatePaymentCode('28')).not.toBeNull()
    expect(validatePaymentCode('1')).not.toBeNull()
  })

  it('odbija vise od 3 cifre', () => {
    expect(validatePaymentCode('2890')).not.toBeNull()
  })

  it('odbija slova', () => {
    expect(validatePaymentCode('abc')).not.toBeNull()
  })
})

describe('buildIpsQrString', () => {
  it('gradi ispravan QR string sa pipe separatorom', () => {
    const result = buildIpsQrString({
      config: validConfig,
      amount: 10470,
      orderNumber: 'DS-2026-00001',
    })

    expect(result).toContain('K:PR')
    expect(result).toContain('V:01')
    expect(result).toContain('C:1')
    expect(result).toContain('R:105000000328120183')
    expect(result).toContain('N:Srdjan Denic, Beograd')
    expect(result).toContain('I:RSD10470,00')
    expect(result).toContain('SF:289')
    expect(result).not.toContain('\n')
  })

  it('koristi | kao separator svih polja', () => {
    const result = buildIpsQrString({
      config: validConfig,
      amount: 5000,
      orderNumber: 'DS-2026-00002',
    })
    const parts = result.split('|')
    expect(parts.length).toBe(9)
    expect(parts[0]).toBe('K:PR')
  })

  it('gradi ispravan RO (poziv na broj) koji pocinje sa 97', () => {
    const result = buildIpsQrString({
      config: validConfig,
      amount: 10470,
      orderNumber: 'DS-2026-00001',
    })
    const ro = result.split('|').find(p => p.startsWith('RO:'))
    expect(ro).toBeDefined()
    // Model 97 = pocinje sa "97"
    expect(ro?.slice(3, 5)).toBe('97')
  })

  it('uklanja slova iz broja porudzbine za RO polje', () => {
    const result1 = buildIpsQrString({ config: validConfig, amount: 1000, orderNumber: 'DS-2026-00001' })
    const result2 = buildIpsQrString({ config: validConfig, amount: 1000, orderNumber: '2026-00001' })
    // RO treba biti isti jer se "DS-" uklanja
    const ro1 = result1.split('|').find(p => p.startsWith('RO:'))
    const ro2 = result2.split('|').find(p => p.startsWith('RO:'))
    expect(ro1).toBe(ro2)
  })

  it('bacate gresku za neispravni racun', () => {
    expect(() =>
      buildIpsQrString({
        config: { ...validConfig, accountNumber: 'RS35invalid' },
        amount: 1000,
        orderNumber: 'DS-2026-00001',
      })
    ).toThrow()
  })

  it('bacate gresku za negativni iznos', () => {
    expect(() =>
      buildIpsQrString({ config: validConfig, amount: -100, orderNumber: 'DS-2026-00001' })
    ).toThrow()
  })

  it('skracuje svrhu placanja na 70 karaktera', () => {
    const longPurpose = 'A'.repeat(100)
    const result = buildIpsQrString({
      config: validConfig,
      amount: 1000,
      orderNumber: 'DS-2026-00001',
      purpose: longPurpose,
    })
    const s = result.split('|').find(p => p.startsWith('S:'))
    expect(s?.slice(2).length).toBeLessThanOrEqual(70)
  })

  it('string potvrden NBS validatorom (DS-2026-00001, 10470 RSD)', () => {
    const result = buildIpsQrString({
      config: validConfig,
      amount: 10470,
      orderNumber: 'DS-2026-00001',
    })
    // Tacno ovaj string je prosao NBS validator sa code 0 OK
    expect(result).toBe(
      'K:PR|V:01|C:1|R:105000000328120183|N:Srdjan Denic, Beograd|I:RSD10470,00|SF:289|S:Porudzbina DS-2026-00001|RO:970311202600001'
    )
  })
})

describe('getIpsQrImageUrl', () => {
  it('vraca URL sa enkodiranim QR stringom', () => {
    const qrString = 'K:PR|V:01|C:1'
    const url = getIpsQrImageUrl(qrString)
    expect(url).toContain('qrserver.com')
    expect(url).toContain(encodeURIComponent(qrString))
  })

  it('koristi podrazumevanu velicinu 300', () => {
    const url = getIpsQrImageUrl('test')
    expect(url).toContain('300x300')
  })

  it('prihvata prilagodenu velicinu', () => {
    const url = getIpsQrImageUrl('test', 200)
    expect(url).toContain('200x200')
  })
})
