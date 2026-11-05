import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { OrderStatus } from '@denic-shop/core/types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Na čekanju',
  confirmed: 'Potvrđena',
  processing: 'U obradi',
  shipped: 'Poslata',
  delivered: 'Isporučena',
  cancelled: 'Otkazana',
  refunded: 'Refundirana',
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: '#faeeda',
  confirmed: '#e1f5ee',
  processing: '#e6f1fb',
  shipped: '#eeedfe',
  delivered: '#eaf3de',
  cancelled: '#fcebeb',
  refunded: '#f1efe8',
}

export function OrdersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | ''>('')

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { search, status }],
    queryFn: () => api.orders.list({ ...(search && { search }), ...(status && { status }) }),
  })

  async function handleExport() {
    const res = await api.orders.exportCsv()
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'porudzbine.csv'
    a.click()
  }

  const orders = (data as any) ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Porudžbine</h1>
        <button onClick={handleExport} style={exportBtnStyle}>Izvoz CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          placeholder="Pretraga (broj, email, ime)…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
        <select value={status} onChange={e => setStatus(e.target.value as OrderStatus | '')} style={selectStyle}>
          <option value="">Svi statusi</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <p style={{ color: '#888' }}>Učitavanje…</p>
      ) : (
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr>
                {['Broj', 'Kupac', 'Grad', 'Iznos', 'Metoda', 'Status', 'Datum', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o: any) => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f1efe8' }}>
                  <td style={tdStyle}><code style={{ fontSize: 12 }}>{o.orderNumber}</code></td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500 }}>{o.shippingName}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{o.shippingEmail}</div>
                  </td>
                  <td style={tdStyle}>{o.shippingCity}</td>
                  <td style={tdStyle}><strong>{(o.totalRsd).toLocaleString('sr-RS')} RSD</strong></td>
                  <td style={tdStyle}>{o.paymentMethod === 'ips_qr' ? 'IPS QR' : o.paymentMethod === 'cod' ? 'Pouzećem' : 'Uplata'}</td>
                  <td style={tdStyle}>
                    <span style={{ ...badgeStyle, background: STATUS_COLORS[o.status as OrderStatus] }}>
                      {STATUS_LABELS[o.status as OrderStatus]}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: '#888' }}>
                    {new Date(o.createdAt).toLocaleDateString('sr-RS')}
                  </td>
                  <td style={tdStyle}>
                    <Link to="/orders/$id" params={{ id: o.id }} style={{ fontSize: 13, color: '#534AB7' }}>
                      Detalji →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const tableWrap: React.CSSProperties = { background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e9e7e1' }
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const thStyle: React.CSSProperties = { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#888', borderBottom: '1px solid #e9e7e1', background: '#fafaf8' }
const tdStyle: React.CSSProperties = { padding: '12px 16px', fontSize: 14, verticalAlign: 'middle' }
const badgeStyle: React.CSSProperties = { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500 }
const searchStyle: React.CSSProperties = { flex: 1, border: '1px solid #d3d1c7', borderRadius: 8, padding: '8px 12px', fontSize: 14 }
const selectStyle: React.CSSProperties = { border: '1px solid #d3d1c7', borderRadius: 8, padding: '8px 12px', fontSize: 14, background: '#fff' }
const exportBtnStyle: React.CSSProperties = { background: '#fff', border: '1px solid #d3d1c7', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }
