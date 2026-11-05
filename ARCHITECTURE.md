# denic-shop — Arhitektura

> **Status:** Odobreno · 2026  
> Implementacija kreće sa Fazom 1.

---

## Sadržaj

1. [Tehnološki stack](#1-tehnološki-stack)
2. [Model podataka](#2-model-podataka)
3. [Plugin interfejsi i order flow](#3-plugin-interfejsi-i-order-flow)
4. [Faze razvoja](#4-faze-razvoja)
5. [Šta ostaje, šta se menja](#5-šta-ostaje-šta-se-menja)

---

## 1. Tehnološki stack

### Deployment model

Svaki klijent = zasebna Cloudflare Workers instanca + zasebna D1 baza. Nema multi-tenanta, nema `tenantId`. Podešavanja idu u `settings` tabelu ili Cloudflare secrets (API ključevi, tajne).

### Runtime i infrastruktura

| Biblioteka | Verzija | CF Workers | Napomena |
|---|---|---|---|
| **Cloudflare Workers** | runtime | ✅ native | V8 isolates |
| **Cloudflare D1** | — | ✅ native | SQLite per instanca |
| **Cloudflare R2** | — | ✅ native | Fajlovi (slike, digitalni proizvodi) |
| **Cloudflare Workflows** | GA | ✅ native | Durable checkout, fulfillment flow |
| **Cloudflare Queues** | — | ✅ native | Async events (email, webhook, fiskalizacija) |
| **Cloudflare Cron Triggers** | — | ✅ native | Scheduled jobs (auto-cancel, cleanup) |
| **Cloudflare Images** | — | ✅ native | CDN resize/format transformacije |
| **Cloudflare Zaraz** | — | ✅ native | Third-party skripte (analytics) |
| **Cloudflare Turnstile** | — | ✅ native | Bot protection na checkout-u |

### API sloj (Workers)

| Biblioteka | Verzija pri instalaciji | CF Workers | Napomena |
|---|---|---|---|
| **Hono** | latest stable | ✅ | Dizajniran za edge runtime |
| **@hono/zod-openapi** | latest stable | ✅ | OpenAPI schema + validacija ruta |
| **Hono RPC** | (ugrađen) | ✅ | Type-safe klijent iz route definicija |
| **Drizzle ORM** | latest stable | ✅ | Jedini ORM za D1; `drizzle-orm/d1` |
| **Zod** | latest stable (^4.x) | ✅ | Schema validacija |
| **Better Auth** | latest stable | ✅ | D1 adapter; sessions, roles, staff accounts |
| **Dinero.js** | latest stable | ✅ | Immutable novčane vrednosti; pure JS |

### Admin frontend (Pages)

| Biblioteka | Verzija pri instalaciji | Napomena |
|---|---|---|
| **React** | latest stable (^19.x) | — |
| **React Router** | latest stable (^7.x) | Zvanično podržan Refine adapter |
| **TanStack Query** | latest stable | Zadržati |
| **Refine** | latest stable | Data/CRUD framework; `@refinedev/react-router` adapter |
| **shadcn/ui** | latest stable | Komponente; Tailwind v4 |
| **TanStack Table** | latest stable | Data grids |
| **React Hook Form** | latest stable | Forme |
| **Tiptap** | latest stable (^3.x) | Rich text editor |
| **dnd-kit** | latest stable | Drag & drop (sortiranje slika, varijanti) |
| **XState** | latest stable | Order state machine |

> **Napomena o routeru:** Prelazimo sa TanStack Router na **React Router v7** jer Refine nema zvaničan TanStack Router adapter, a pisanje sopstvenog adaptera je manualni posao koji izbegavamo.

### Email i dokumenti

| Biblioteka | Verzija pri instalaciji | CF Workers | Napomena |
|---|---|---|---|
| **React Email** | latest stable | ✅ | HTML email komponente |
| **Resend** | latest stable | ✅ | REST API, nema Node ovisnosti |
| **pdf-lib** | latest stable | ✅ | Fakture, otpremnice; čist JS |

### Testiranje i kvalitet

| Biblioteka | Verzija pri instalaciji | Napomena |
|---|---|---|
| **Vitest** | latest stable | Unit testovi |
| **Playwright** | latest stable | E2E browser testovi |
| **MSW** | latest stable | Mock API u testovima |
| **@sentry/cloudflare** | latest stable | Error monitoring za Workers |
| **@changesets/cli** | latest stable | Versioning |
| **Renovate** | — | Automatski PR-ovi za updates |

---

## 2. Model podataka

Nema `tenantId` — jedna instanca, jedna baza. Svi iznosi su `integer` (najmanji deo valute: para ili euro cent) uz `currency_code` polje.

### Podešavanja instance

```
settings
├── key: string (PK)
└── value: text (JSON ili string)

Primeri: shop_name, shop_email, default_currency,
         seller_name, seller_account (IPS QR), seller_pib (fakture)
         tax_id, fiscal_provider_type,
         order_number_prefix ('DS' → 'DS-2026-00001'; '' → '1001')
         order_auto_cancel_days (default: 3)

API ključevi (Resend, NestPay, Stripe, fiskalizacija):
  → Cloudflare secrets (env vars), nikad u bazi
```

### Staff korisnici (Better Auth)

```
users              (Better Auth managed)
├── id, email, name, emailVerified
├── role: owner | admin | staff
└── createdAt, updatedAt

sessions           (Better Auth managed)

user_audit_log
├── id, userId, action, resourceType, resourceId
├── before: json, after: json
└── createdAt
```

### Prodajni katalog

```
products
├── id, slug (unique), name
├── description: text (Tiptap HTML)
├── status: draft | active | archived
├── hasVariants: bool
├── productType: physical | digital | service
└── categoryId → product_categories

product_variants
├── id, productId → products
├── sku (globally unique), name
├── requiresShipping: bool   ← fizički vs. digitalni
├── allowBackorder: bool
├── weight?: integer (grami), weightUnit: 'g'|'kg'
└── sortOrder

variant_prices                 ← jedna cena po varijanti po valuti (Medusa model)
├── id
├── variantId → product_variants
├── currencyCode: 'RSD' | 'EUR'
├── amount: integer (para / euro cent)
└── compareAtAmount?: integer  (stara cena, za prikaz -X%)

product_options
├── id, productId, name, sortOrder

product_option_values
├── id, optionId, value, sortOrder

product_variant_options    (many-to-many)
├── variantId, optionValueId

product_media
├── id, productId, variantId?
├── r2Key, url, alt, mimeType
├── isCover: bool, sortOrder

digital_assets             (fajl vezan za varijantu; requiresShipping=false)
├── id, variantId → product_variants
├── r2Key, filename, mimeType, fileSize
└── updatedAt

digital_downloads          (log preuzimanja, kreira se pri plaćanju)
├── id, lineItemId → order_line_items
├── token (unique UUID, ide u potpisan URL)
├── expiresAt, maxDownloads, downloadCount
└── createdAt

product_categories
├── id, parentId? (self-referential)
├── slug (unique), name, description
└── sortOrder

collections
├── id, slug (unique), name, description
├── type: manual | automatic
├── conditions?: json
├── sortOrder, published: bool
└── updatedAt

collection_products        (manual kolekcije)
├── collectionId, productId, sortOrder

product_tags
├── id, name (unique)

product_tag_assignments
├── productId, tagId

product_metafields
├── id, resourceType: 'product'|'variant'|'category', resourceId
├── namespace, key
├── valueType: 'string'|'integer'|'json'|'boolean'
└── value: text

tax_rates
├── id, name           (npr. "PDV 20%", "PDV 10%", "§19 oslobođen")
├── rate: integer      (2000 = 20.00%, 1000 = 10.00%, 0 = 0%)
├── isDefault: bool
└── appliesTo: 'all' | 'specific_categories'

tax_rate_category_assignments
├── taxRateId, categoryId
```

### Zalihe

```
inventory_items            (1:1 sa product_variants)
├── id, variantId
└── sku

inventory_levels
├── id, inventoryItemId, locationId
├── onHand, reserved
└── available: integer (computed: onHand - reserved)

locations
├── id, name, type: 'warehouse'|'store'|'virtual'
├── isDefault: bool
└── address fields
```

### Korpa

```
carts
├── id, token (cookie identifier)
├── customerId? → customers
├── email?, phone?
├── currencyCode: 'RSD'|'EUR'
├── subtotal, discountTotal, shippingTotal, taxTotal, total (svi integer)
├── discountCodeId? → discounts
├── shippingZoneRateId? → shipping_zone_rates
├── completedAt?
└── updatedAt

cart_items
├── id, cartId → carts
├── variantId → product_variants
├── quantity, unitPrice, totalPrice
└── updatedAt
```

### Kupci

```
customers
├── id, email (unique), phone?
├── firstName, lastName
├── companyName?, pib?, mb?
├── acceptsMarketing: bool
└── createdAt

customer_addresses
├── id, customerId
├── firstName, lastName, company?
├── street, city, postalCode, country
└── isDefault: bool
```

### Porudžbine

```
orders
├── id
├── orderNumber: text  ← format podešavan: 'DS-2026-00001' ili '1001'
├── customerId? → customers
│
│  Tri nezavisna statusa (XState paralelna stanja):
├── status: 'open' | 'completed' | 'cancelled'
├── paymentStatus: 'pending' | 'awaiting' | 'cod_pending' |
│                 'paid' | 'partially_refunded' | 'refunded' |
│                 'voided' | 'failed'
├── fulfillmentStatus: 'unfulfilled' | 'fulfillment_created' |
│                     'partial' | 'shipped' | 'fulfilled' | 'returned'
│
├── currencyCode: 'RSD'|'EUR'
├── subtotal, discountTotal, shippingTotal, taxTotal, total (svi integer)
├── taxRateId? → tax_rates
├── discountCodeId? → discounts
├── paymentMethod: 'ips_qr' | 'cod' | 'nestpay' | 'stripe'
├── shippingZoneRateId? → shipping_zone_rates
├── notes?, cancelReason?, cancelledAt?
└── createdAt, updatedAt

order_line_items
├── id, orderId → orders
├── variantId → product_variants
├── productName, variantName, sku  (snapshot)
├── unitPrice, quantity, totalPrice (integer)
├── taxRate? (snapshot)
├── requiresShipping: bool (snapshot)
└── fulfillmentStatus

order_shipping_address
── firstName, lastName, company?, street, city, postalCode, country, phone?

order_billing_address
── firstName, lastName, companyName?, pib?, mb?, street, city, postalCode, country

order_transactions
├── id, orderId → orders
├── type: 'authorization'|'capture'|'refund'|'void'
├── amount: integer, currencyCode
├── provider: 'ips_qr'|'nestpay'|'stripe'|'cod'
├── externalId?, status: 'pending'|'success'|'failure'
└── metadata: json

order_timeline
├── id, orderId → orders
├── userId? → users (null = sistem)
├── event: string
├── body?: text
└── createdAt

fulfillments
├── id, orderId → orders
├── status: 'pending'|'shipped'|'delivered'|'failed'
├── trackingNumber?, trackingUrl?
├── shippingProviderId?
└── shippedAt?, deliveredAt?

fulfillment_items
├── fulfillmentId, lineItemId, quantity

returns
├── id, orderId → orders
├── status: 'pending'|'approved'|'received'|'refunded'
└── reason

return_items
├── returnId, lineItemId, quantity, reason

fiscal_receipts
├── id, orderId → orders
├── type: 'sale' | 'void'
├── provider: 'suf_rs' | 'custom'
├── fiscalNumber, verificationUrl, issuedAt
└── pdfR2Key?

idempotency_keys
├── key (PK)
├── requestHash, responseStatus, responseBody: text
└── createdAt, expiresAt
```

### Promocije

```
discounts
├── id, code (unique)
├── type: 'percentage'|'fixed_amount'|'free_shipping'
├── value: integer
├── appliesTo: 'order'|'specific_products'|'specific_categories'
├── minimumOrder?: integer, usageLimit?, usageCount
├── startsAt?, endsAt?, active: bool

discount_product_assignments (many-to-many)
discount_category_assignments (many-to-many)
```

### Dostava *(ručne zone u Fazi 1; API kurira u Fazi 3)*

```
shipping_zones
├── id, name  (npr. "Srbija", "EU")
└── countries: json array

shipping_zone_rates
├── id, zoneId → shipping_zones
├── name  (npr. "Standardna dostava", "Express")
├── currencyCode, amount: integer
├── freeAboveAmount?: integer
├── minWeight?, maxWeight?
└── active: bool

shipping_provider_configs  (Faza 3; konfiguracija API kurira)
├── id, type: 'slanjepaketa' | 'custom'
├── name, enabled: bool
└── config: json
```

### SEO i redirect-i

```
redirects
├── id, from (unique), to, statusCode: 301|302
└── active: bool
```

---

## 3. Plugin interfejsi i order flow

### Pravilo fiskalizacije

**Jedna tačka:** `payment → 'paid'` uvek okida fiskalizaciju, za sve tokove.

- IPS / kartice: fiskalizacija odmah pri potvrdi uplate
- COD: fiskalizacija kad kurir javi naplatu (payment prelazi u `paid`)
- Digitalni: fiskalizacija pri uplati (isti trigger)
- Otkazivanje / povraćaj plaćene porudžbine: `FiscalProvider.void()`

> **Napomena za računovođu / servis za fiskalizaciju:** Ako servis zahteva avansni račun pri uplati i konačni pri isporuci — to se može dodati kao konfigurabilna opcija, ali arhitektura definiše jednu tačku za sada.

### Rezervacija zaliha i auto-otkazivanje

- **Pri kreiranju porudžbine:** `inventory_levels.reserved += quantity`
- **Pri plaćanju (`paid`):** reserved se pretvara u smanjenje `onHand`
- **Auto-otkazivanje:** Cloudflare Cron svaki sat proverava porudžbine sa `paymentStatus = 'awaiting'` starije od `settings.order_auto_cancel_days`. Otkazuje ih i oslobađa zalihe (`reserved -= quantity`).

### Tri toka porudžbine

#### Tok A — IPS QR i kartice

```
Cart → Checkout → ORDER (open / awaiting / unfulfilled)
                       │
         ┌─────────────┴──────────────┐
   [payment webhook]           [timeout / auto-cancel]
         │                           │
ORDER (open / paid / unfulfilled)  ORDER (cancelled / failed / unfulfilled)
         │                           └── reserved zalihe oslobođene
   [ON PAID → fiskalizacija]
   [staff: pack]
         │
ORDER (open / paid / fulfillment_created)
         │
   [tracking dodat]
         │
ORDER (open / paid / shipped)
         │
   [delivered]
         │
ORDER (completed / paid / fulfilled)
```

#### Tok B — Pouzeće (COD)

```
Cart → Checkout → ORDER (open / cod_pending / unfulfilled)
                       │
                 [staff: pack]
                       │
              ORDER (open / cod_pending / fulfillment_created)
                       │
                 [tracking; šalje kurir]
                       │
              ORDER (open / cod_pending / shipped)
                       │
         ┌─────────────┴──────────────┐
   [kurir naplatio]            [kurir vratio]
         │                           │
ORDER (open / paid / shipped)  ORDER (cancelled / failed / returned)
         │
   [ON PAID → fiskalizacija]
   [delivered]
         │
ORDER (completed / paid / fulfilled)
```

#### Tok C — Digitalni proizvodi

```
Cart → Checkout → ORDER (open / awaiting / unfulfilled)
                       │
                 [payment webhook]
                       │
ORDER (open / paid / unfulfilled)
         │
   [ON PAID → fiskalizacija]
   [ON PAID → kreirati digital_downloads, poslati email]
         │
ORDER (completed / paid / fulfilled)   ← auto, bez fizičkog slanja
```

#### Otkazivanje i povraćaj

```
ORDER (any / paid / *)
    │
    │ [staff action]
    ▼
[PaymentProvider.refundPayment()] + [FiscalProvider.void()]
    │
ORDER (cancelled / refunded / *) ili (completed / partially_refunded / returned)
```

### XState mašina

```typescript
const orderMachine = createMachine({
  type: 'parallel',
  states: {
    order: {
      initial: 'open',
      states: {
        open: {},
        completed: { type: 'final' },
        cancelled: { type: 'final' },
      }
    },
    payment: {
      initial: 'pending',
      states: {
        pending: {},
        awaiting: {},      // IPS/kartice — čeka webhook
        cod_pending: {},   // COD — naplaćuje kurir
        paid: {},
        partially_refunded: {},
        refunded: {},
        voided: {},
        failed: {},
      }
    },
    fulfillment: {
      initial: 'unfulfilled',
      states: {
        unfulfilled: {},
        fulfillment_created: {},
        partial: {},
        shipped: {},
        fulfilled: {},
        returned: {},
      }
    }
  }
})
```

**Plugin hook points:**

| Trigger | Akcija |
|---|---|
| `payment → paid` | FiscalProvider.fiscalize() — za SVE tokove |
| `payment → paid` + digital items | Kreirati digital_downloads, poslati email |
| `payment → paid` (COD) | Kurir potvrdio naplatu |
| `order.cancelled` after `payment.paid` | PaymentProvider.refundPayment() + FiscalProvider.void() |
| Svaka promena statusa | Queue → webhook dispatch, email notifikacija |

### PaymentProvider interfejs

```typescript
interface PaymentProvider {
  readonly type: 'ips_qr' | 'cod' | 'nestpay' | 'stripe'
  initiatePayment(order: Order, config: unknown): Promise<PaymentSession>
  capturePayment(session: PaymentSession, payload: unknown): Promise<TransactionResult>
  refundPayment(transaction: Transaction, amount: number): Promise<TransactionResult>
  generateQr?(order: Order, config: unknown): Promise<{ qrString: string; imageUrl: string }>
}
```

### FiscalProvider interfejs

```typescript
interface FiscalProvider {
  readonly type: 'suf_rs' | 'custom'
  fiscalize(order: Order, config: unknown): Promise<FiscalReceipt>
  void(receipt: FiscalReceipt, config: unknown): Promise<void>
}
```

### ShippingProvider interfejs

```typescript
interface ShippingProvider {
  readonly type: 'slanjepaketa' | 'custom'
  calculateRate(cart: Cart, address: ShippingAddress, config: unknown): Promise<ShippingRate[]>
  createShipment(fulfillment: Fulfillment, config: unknown): Promise<ShipmentResult>
  trackShipment(trackingNumber: string, config: unknown): Promise<TrackingStatus>
}
```

---

## 4. Faze razvoja

### Faza 1 — Temelji + katalog + prodaja

**Cilj:** Može se prodavati od prvog dana.

- [ ] Čista Drizzle schema (svi modeli iz §2)
- [ ] Better Auth (staff accounts, roles: owner/admin/staff)
- [ ] Hono + @hono/zod-openapi + Hono RPC
- [ ] Katalog: products, variants, options (matrix), variant_prices (RSD+EUR), kategorije, media, metafields
- [ ] Tiptap opis, dnd-kit sortiranje
- [ ] Korpa i checkout: carts, cart_items, idempotency_keys, Turnstile
- [ ] Shipping zones i rates (ručno unete, Faza 3 dodaje API kurira)
- [ ] Plaćanje: IPS QR + COD
- [ ] Porudžbine: order management, timeline, XState (tokovi A + B)
- [ ] Rezervacija zaliha + auto-cancel Cron
- [ ] Email: React Email + Resend (potvrda, COD)
- [ ] Admin dashboard: Refine + React Router + shadcn/ui + React Hook Form
- [ ] Vitest unit testovi: IPS QR, cene (Dinero.js), zalihe, order tranzicije
- [ ] GitHub Actions CI: `pnpm test` + Playwright
- [ ] Sentry integracija
- [ ] Storefront starter kit (`packages/storefront`)
- [ ] Probna prodavnica (Pages demo)
- [ ] Export svih podataka + skripta za selidbu instance

### Faza 2 — Kartice + fiskalizacija + digitalni

- [ ] NestPay integracija
- [ ] Stripe integracija
- [ ] FiscalProvider (SUF RS)
- [ ] Storno pri otkazivanju/povratu
- [ ] Digitalni proizvodi: digital_assets, digital_downloads, tok C
- [ ] PDF fakture

### Faza 3 — Dostava API i povraćaji

- [ ] ShippingProvider (slanjepaketa API, label printing)
- [ ] Delimično slanje
- [ ] Returns flow
- [ ] Cloudflare Workflows za checkout

### Faza 4 — Kupci, marketing, kolekcije

- [ ] Customer accounts
- [ ] Discount codes + automatic discounts
- [ ] Collections (manual + automatic)
- [ ] Napuštene korpe
- [ ] Cloudflare Zaraz
- [ ] Cloudflare Images integracija

### Faza 5 — Napredne funkcije

- [ ] FTS5 pretraga
- [ ] Multi-location inventory
- [ ] Webhook dispatch
- [ ] B2B (firme, cenovnici)
- [ ] Renovate

---

## 5. Šta ostaje, šta se menja

### Ostaje

| Komponenta | Razlog |
|---|---|
| **IPS QR logika** (`packages/core/src/lib/ips-qr.ts`) | Radi, testirana |
| **Vitest testovi** | Temelj CI-a |
| **Cloudflare Workers + D1 + R2** | Infrastruktura ostaje |
| **TanStack Query** | Zadržati |
| **Hono** | Proširuje se sa zod-openapi |
| **Drizzle ORM** | Schema se menja, ORM ostaje |

### Menja se

| Staro | Novo |
|---|---|
| Multi-tenant (tenantId) | Jedna instanca |
| `priceRsd` integer | `variant_prices` tabela (RSD + EUR) |
| TanStack Router | React Router v7 (Refine kompatibilnost) |
| Ručni JWT middleware | Better Auth |
| `useState` forme | React Hook Form |
| Nema order mašine | XState (tri paralelna stanja) |
| Nema fiskalizacije | `fiscal_receipts` + FiscalProvider |
| Shipping zones tek u Fazi 3 | Ručne zone u **Fazi 1** |

### Produkcija

Ne postoji. Krećemo čisto po novoj šemi.

---

*Implementacija počinje sa Fazom 1.*
