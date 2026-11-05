export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  BETTER_AUTH_SECRET: string
  RESEND_API_KEY: string
  // IPS QR konfiguracija (seller podaci)
  IPS_RECIPIENT_NAME: string
  IPS_ACCOUNT_NUMBER: string
  IPS_PIB: string
  IPS_MODEL: string
  IPS_REFERENCE_PREFIX: string
}
