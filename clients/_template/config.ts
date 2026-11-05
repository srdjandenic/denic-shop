/**
 * Konfiguracija klijenta — jedino mesto koje se menja per-klijent.
 * Importuje se u seed skripti i worker-u.
 */
export const clientConfig = {
  tenant: {
    slug: 'TENANT_SLUG',
    name: 'Naziv Prodavnice',
    domain: 'prodavnica.rs',
    settings: {
      currency: 'RSD' as const,
      emailFrom: 'noreply@prodavnica.rs',
      logoR2Key: null as string | null,
      primaryColor: '#1a1a1a',
      shippingFlatRsd: 490,
      freeShippingAboveRsd: 5000,
    },
  },

  // Metode plaćanja koje su aktivne za ovog klijenta
  paymentMethods: {
    ips_qr: {
      active: true,
      config: {
        recipientName: 'Naziv Primaoca d.o.o.',
        accountNumber: 'RS35000000000000000000',   // Zameniti pravim računom
        bankCode: '000',
        pib: '000000000',
        model: '97',
        referencePrefix: '11',
      },
    },
    cod: {
      active: true,
      config: { maxAmountRsd: 50000 },
    },
  },

  // Moduli koji su uključeni za ovog klijenta
  modules: {
    payments: ['ips_qr', 'cod'] as const,
    fiscalization: false,
    shippingIntegration: false,
    digitalProducts: false,
  },
}
