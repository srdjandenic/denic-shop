import type { IpsQrConfig } from '../schema/orders'

export type IpsQrPayload = {
  config: IpsQrConfig
  amount: number          // u dinarima (ceo broj)
  orderNumber: string
  purpose?: string
}

export type IpsQrValidationError = {
  field: string
  message: string
}

/**
 * Mod 97 na velikom broju kao stringu (BigInt nije potreban — korak po korak).
 */
function mod97String(numStr: string): number {
  let r = 0
  for (const ch of numStr) {
    r = (r * 10 + parseInt(ch, 10)) % 97
  }
  return r
}

/**
 * Validacija domaćeg broja računa: 18 numeričkih cifara, kontrolni broj mod 97.
 * Ulaz: "105-0000003281201-83" ili već stripovano "105000000328120183"
 */
export function validateAccountNumber(raw: string): IpsQrValidationError | null {
  const digits = raw.replace(/-/g, '').trim()
  if (!/^\d{18}$/.test(digits)) {
    return {
      field: 'R',
      message: `Broj računa mora biti 18 numeričkih cifara (NBS domaći format, bez crtica). Primljeno ${digits.length} znakova: "${digits}"`,
    }
  }
  // Kontrolni broj: (BBB+CCC+"00") mod 97, check = 98 - rezultat
  const base16 = digits.slice(0, 16)
  const check = parseInt(digits.slice(16), 10)
  const r = mod97String(base16 + '00')
  const expected = 98 - r
  if (check !== expected) {
    return {
      field: 'R',
      message: `Broj računa nije ispravan po modelu 97. Kontrolne cifre: ${check}, očekivano: ${expected}. Proverite broj računa.`,
    }
  }
  return null
}

/**
 * Validacija iznosa: pozitivan ceo broj (dinari, bez para).
 */
export function validateAmount(amount: number): IpsQrValidationError | null {
  if (!Number.isInteger(amount) || amount <= 0) {
    return {
      field: 'I',
      message: `Iznos mora biti pozitivan ceo broj u RSD. Primljeno: ${amount}.`,
    }
  }
  return null
}

/**
 * Validacija šifre plaćanja: tačno 3 cifre.
 */
export function validatePaymentCode(sf: string): IpsQrValidationError | null {
  if (!/^\d{3}$/.test(sf)) {
    return {
      field: 'SF',
      message: `Šifra plaćanja mora biti tačno 3 cifre. Primljeno: "${sf}".`,
    }
  }
  return null
}

/**
 * Gradi numeričnu referencu za IPS QR poziv na broj (model 97).
 *
 * NBS format: model(2) + check(2) + base_reference
 *
 * Algoritam (potvrđen NBS validatorom):
 *   check = 98 - (base + "97") mod 97, padovan na 2 cifre
 *   RO = model + check + base
 *
 * Sva slova iz broja porudžbine se uklanjaju — NBS dozvoljava samo cifre.
 */
function buildIpsReference(model: string, prefix: string, orderNumber: string): string {
  const numericPrefix = prefix.replace(/\D/g, '')
  const numericOrder = orderNumber.replace(/\D/g, '')
  const base = (numericPrefix + numericOrder).slice(0, 20) // max 20 cifara

  // check = 98 - (base + model) mod 97, padovan na 2 cifre
  const r = mod97String(base + model)
  const check = 98 - r
  const checkStr = String(check === 97 ? 0 : check).padStart(2, '0')

  return model + checkStr + base
}

/**
 * Gradi NBS IPS QR string.
 *
 * Separator između polja: | (pipe, ASCII 124) — NBS specifikacija
 * Baca grešku ako validacija ne prođe.
 */
export function buildIpsQrString(payload: IpsQrPayload): string {
  const { config, amount, orderNumber, purpose } = payload

  const accountDigits = config.accountNumber.replace(/-/g, '').trim()

  const errors: IpsQrValidationError[] = [
    validateAccountNumber(accountDigits),
    validateAmount(amount),
    validatePaymentCode('289'),
  ].filter(Boolean) as IpsQrValidationError[]

  if (errors.length > 0) {
    throw new Error(
      `IPS QR validacija nije prošla:\n${errors.map(e => `  [${e.field}] ${e.message}`).join('\n')}`
    )
  }

  const reference = buildIpsReference(config.model, config.referencePrefix, orderNumber)
  const purposeText = (purpose ?? `Porudzbina ${orderNumber}`).slice(0, 70)
  const recipientName = config.recipientName.slice(0, 70)

  const fields = [
    'K:PR',
    'V:01',
    'C:1',
    `R:${accountDigits}`,
    `N:${recipientName}`,
    `I:RSD${amount},00`,
    'SF:289',
    `S:${purposeText}`,
    `RO:${reference}`,
  ]

  return fields.join('|')
}

/**
 * URL za QR sliku (javni generator — za produkciju koristiti lokalni).
 */
export function getIpsQrImageUrl(qrString: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qrString)}&size=${size}x${size}&ecc=M`
}
