#!/usr/bin/env tsx
/**
 * Script za export podataka klijenta — za selidbu ili izlaz.
 * Generiše: JSON dump, CSV porudžbina, R2 media lista, uputstvo.
 *
 * Pokretanje: pnpm tsx scripts/export-data.ts --tenant SLUG --output ./export
 *
 * Zahteva: wrangler CLI, D1 binding konfigurisan, lokalni --local ili --remote flag.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const tenantIdx = args.indexOf('--tenant')
const outputIdx = args.indexOf('--output')
const tenant = tenantIdx !== -1 ? args[tenantIdx + 1] : null
const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : './export'

if (!tenant) {
  console.error('Greška: --tenant SLUG je obavezan')
  process.exit(1)
}

const TABLES = [
  'tenants', 'users', 'categories', 'products',
  'product_variants', 'product_media', 'customers',
  'addresses', 'orders', 'order_items', 'payments', 'payment_methods',
]

function wrangler(cmd: string): string {
  return execSync(`wrangler ${cmd}`, { stdio: 'pipe' }).toString()
}

async function main() {
  console.log(`Exportujem podatke za klijenta: ${tenant}`)
  const exportPath = join(outputDir!, tenant!)
  mkdirSync(exportPath, { recursive: true })

  // 1. JSON dump svih tabela
  console.log('1/4 Exportujem tabele…')
  const jsonDir = join(exportPath, 'json')
  mkdirSync(jsonDir, { recursive: true })

  for (const table of TABLES) {
    try {
      const result = wrangler(`d1 execute denic-shop-${tenant} --command "SELECT * FROM ${table}" --json`)
      writeFileSync(join(jsonDir, `${table}.json`), result)
      console.log(`  ✓ ${table}`)
    } catch (e) {
      console.warn(`  ✗ ${table}: ${(e as Error).message}`)
    }
  }

  // 2. CSV porudžbine
  console.log('2/4 Exportujem CSV porudžbina…')
  const csvResult = wrangler(`d1 execute denic-shop-${tenant} --command "SELECT order_number,status,shipping_name,shipping_email,shipping_city,shipping_phone,total_rsd,payment_method,payment_status,created_at FROM orders ORDER BY created_at" --json`)
  const csvData = JSON.parse(csvResult)
  const rows: Record<string, unknown>[] = csvData[0]?.results ?? []
  const header = Object.keys(rows[0] ?? {}).join(',')
  const csv = [header, ...rows.map(r => Object.values(r).map(v => `"${v}"`).join(','))].join('\n')
  writeFileSync(join(exportPath, 'porudzbine.csv'), csv)
  console.log(`  ✓ ${rows.length} porudžbina`)

  // 3. Lista R2 fajlova
  console.log('3/4 Listam R2 medije…')
  try {
    const r2List = wrangler(`r2 object list denic-shop-${tenant}-media`)
    writeFileSync(join(exportPath, 'r2-media-list.txt'), r2List)
    console.log('  ✓ Lista sačuvana (preuzmi fajlove manuelno ili wrangler r2 object get)')
  } catch {
    console.warn('  ✗ R2 lista nije dostupna')
  }

  // 4. Uputstvo za selidbu
  console.log('4/4 Generišem uputstvo…')
  const guide = `# Uputstvo za selidbu — ${tenant}
Datum: ${new Date().toISOString()}

## Šta je exportovano
- json/ — JSON dump svih tabela
- porudzbine.csv — CSV export porudžbina
- r2-media-list.txt — lista medija u R2 bucket-u

## Koraci za selidbu na sopstveni Cloudflare nalog

1. Kloniraj repozitorijum:
   git clone https://github.com/srdjandenic/denic-shop.git
   cd denic-shop

2. Instaliraj zavisnosti:
   pnpm install

3. Kopiraj template klijenta:
   cp -r clients/_template clients/${tenant}

4. Konfiguriši wrangler.toml sa tvojim podacima

5. Kreiraj D1 bazu:
   wrangler d1 create denic-shop-${tenant}

6. Pokreni migracije:
   cd packages/api && pnpm db:migrate:remote

7. Importuj podatke iz json/ direktorijuma:
   wrangler d1 execute denic-shop-${tenant} --file=import.sql

8. Kreiraj R2 bucket i preuzmi medije:
   wrangler r2 bucket create denic-shop-${tenant}-media
   # Preuzmi fajlove iz r2-media-list.txt

9. Deploy API:
   cd clients/${tenant} && wrangler deploy

## Podrška
Denic Design — srdjandenic@gmail.com
`
  writeFileSync(join(exportPath, 'migration-guide.md'), guide)
  console.log('\nExport završen:', exportPath)
}

main().catch(console.error)
