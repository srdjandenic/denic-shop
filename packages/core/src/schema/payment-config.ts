// Payment method configuration types (ne idu u bazu — idu u Cloudflare secrets)
// Koristi se u ips-qr.ts i payment provider implementacijama

export type IpsQrConfig = {
  recipientName: string
  accountNumber: string
  bankCode: string
  pib: string
  model: string
  referencePrefix: string
}

export type CodConfig = {
  maxAmount?: number
}
