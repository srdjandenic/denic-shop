import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.products.list(),
  })

  const products = (data as any)?.data ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Proizvodi</h1>
        <button style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}>
          + Novi proizvod
        </button>
      </div>

      {isLoading ? (
        <p style={{ color: '#888' }}>Učitavanje…</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {products.map((p: any) => {
            const cover = p.productMedia?.[0]
            const minPrice = Math.min(...(p.productVariants?.map((v: any) => v.priceRsd) ?? [0]))
            return (
              <div key={p.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', overflow: 'hidden' }}>
                {cover ? (
                  <div style={{ height: 160, background: '#f5f5f4', overflow: 'hidden' }}>
                    <img src={cover.r2Key} alt={cover.alt ?? p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ height: 100, background: '#f1efe8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b4b2a9', fontSize: 13 }}>
                    Bez slike
                  </div>
                )}
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{p.productVariants?.length ?? 0} var.</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{minPrice.toLocaleString('sr-RS')} RSD</span>
                    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 20, background: p.published ? '#eaf3de' : '#f1efe8', color: p.published ? '#3B6D11' : '#5f5e5a' }}>
                      {p.published ? 'Aktivan' : 'Skriveni'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
