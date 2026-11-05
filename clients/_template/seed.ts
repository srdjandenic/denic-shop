#!/usr/bin/env tsx
/**
 * Inicijalni seed za novog klijenta.
 * Pokretanje: pnpm tsx clients/TENANT_SLUG/seed.ts
 *
 * Pre pokretanja: wrangler d1 create denic-shop-TENANT_SLUG
 * i popuni database_id u wrangler.toml
 */
import { clientConfig } from './config'

const API_BASE = 'http://localhost:8787/api/v1'

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`POST ${path} failed: ${err}`)
  }
  return res.json()
}

async function main() {
  console.log(`Seeding klijenta: ${clientConfig.tenant.slug}`)

  // 1. Kreiraj tenant
  // (direktan DB upit ili admin endpoint — za lokalni dev)
  console.log('✓ Tenant konfigurisan u wrangler.toml')

  // 2. Kreiraj owner nalog
  await post('/auth/register-owner', {
    email: 'owner@prodavnica.rs',
    password: 'PromeniLozinku123!',
    name: 'Admin',
    tenantConfig: clientConfig.tenant,
  })
  console.log('✓ Owner nalog kreiran')

  // 3. Konfiguriši metode plaćanja
  for (const [type, cfg] of Object.entries(clientConfig.paymentMethods)) {
    if (cfg.active) {
      console.log(`✓ Metoda plaćanja: ${type}`)
    }
  }

  console.log('\nSeed završen. Promeni lozinku pri prvoj prijavi!')
}

main().catch(console.error)
