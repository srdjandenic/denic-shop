import type { IpsQrConfig } from '../schema/orders'

/**
 * IPS QR kod standard (NBS, ISO 20022 format za Srbiju).
 * Generiše string koji se enkoduje u QR kod za plaćanje.
 *
 * Spec: https://www.nbs.rs/sr_Cyrl/platni_promet/ips/index.html
 */
export type IpsQrPayload = {
  config: IpsQrConfig
  amount: number          // u dinarima (ceo broj)
  orderNumber: string
  purpose?: string        // opis plaćanja
}

export function buildIpsQrString(payload: IpsQrPayload): string {
  const { config, amount, orderNumber, purpose } = payload

  const reference = buildIpsReference(config.model, config.referencePrefix, orderNumber)
  const purposeText = purpose ?? `Porudzbina ${orderNumber}`

  // NBS IPS format: redosled polja je fiksan
  const lines = [
    'K:PR',                                   // identifikator
    `V:01`,                                   // verzija
    `C:1`,                                    // karakter set (1 = UTF-8)
    `R:${config.accountNumber}`,              // račun primaoca
    `N:${config.recipientName}`,              // naziv primaoca
    `I:RSD${formatAmount(amount)}`,           // iznos
    `SF:289`,                                 // šifra plaćanja
    `S:${purposeText}`,                       // svrha
    `RO:${reference}`,                        // poziv na broj
  ]

  return lines.join('\n')
}

function formatAmount(amountRsd: number): string {
  // Format: 12500 → "12500,00"
  return `${amountRsd},00`
}

function buildIpsReference(model: string, prefix: string, orderNumber: string): string {
  // Uklanja crtice iz broja porudžbine za poziv na broj
  const stripped = orderNumber.replace(/-/g, '')
  return `${model}${prefix}${stripped}`
}

/**
 * Vraća URL za generisanje QR slike (za prikaz u browseru/emailu).
 * Koristi javni QR generator — za produkciju, generiši lokalno.
 */
export function getIpsQrImageUrl(qrString: string, size = 300): string {
  const encoded = encodeURIComponent(qrString)
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encoded}&size=${size}x${size}&ecc=M`
}
