import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ORDER_STATUSES } from '@denic-shop/core/schema'

export function OrderDetailPage() {
  const { id } = useParams({ from: '/_dashboard/orders/$id' })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.orders.get(id),
  })

  const { data: qrData } = useQuery({
    queryKey: ['order-qr', id],
    queryFn: () => api.orders.ipsQr(id),
    enabled: (data as any)?.paymentMethod === 'ips_qr',
  })

  const mutation = useMutation({
    mutationFn: (status: string) => api.orders.updateStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['order', id] }),
  })

  if (isLoading) return <p>Učitavanje…</p>

  const order = (data as any)
  const qr = (qrData as any)

  if (!order) return <p>Porudžbina nije pronađena.</p>

  return (
    <div>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 500 }}>Porudžbina {order.orderNumber}</h1>
      <p style={{ margin: '0 0 24px', color: '#888', fontSize: 14 }}>
        {new Date(order.createdAt).toLocaleString('sr-RS')}
      </p>

      <div style={grid2}>
        <section style={card}>
          <h3 style={cardTitle}>Kupac</h3>
          <p style={infoRow}><span style={infoLabel}>Ime:</span> {order.shippingName}</p>
          <p style={infoRow}><span style={infoLabel}>Email:</span> {order.shippingEmail}</p>
          <p style={infoRow}><span style={infoLabel}>Telefon:</span> {order.shippingPhone ?? '—'}</p>
          <p style={infoRow}><span style={infoLabel}>Adresa:</span> {order.shippingStreet}, {order.shippingCity} {order.shippingPostalCode}</p>
        </section>

        <section style={card}>
          <h3 style={cardTitle}>Plaćanje</h3>
          <p style={infoRow}><span style={infoLabel}>Metoda:</span> {order.paymentMethod}</p>
          <p style={infoRow}><span style={infoLabel}>Status:</span> {order.paymentStatus}</p>
          <p style={infoRow}><span style={infoLabel}>Iznos:</span> <strong>{order.totalRsd.toLocaleString('sr-RS')} RSD</strong></p>
          {qr && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>IPS QR kod:</p>
              <img src={qr.imageUrl} alt="IPS QR" width={160} style={{ borderRadius: 8 }} />
            </div>
          )}
        </section>
      </div>

      <section style={{ ...card, marginTop: 16 }}>
        <h3 style={cardTitle}>Stavke</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Proizvod', 'SKU', 'Cena', 'Kol.', 'Ukupno'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#888', borderBottom: '1px solid #e9e7e1' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.orderItems?.map((item: any) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                <td style={{ padding: '10px 12px', fontSize: 14 }}>
                  <div style={{ fontWeight: 500 }}>{item.productName}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{item.variantName}</div>
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{item.sku}</td>
                <td style={{ padding: '10px 12px', fontSize: 14 }}>{item.unitPriceRsd.toLocaleString('sr-RS')} RSD</td>
                <td style={{ padding: '10px 12px', fontSize: 14 }}>{item.quantity}</td>
                <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{item.totalRsd.toLocaleString('sr-RS')} RSD</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px', textAlign: 'right', fontSize: 14 }}>
          <span style={{ marginRight: 8, color: '#888' }}>Dostava:</span> {order.shippingRsd.toLocaleString('sr-RS')} RSD
          <span style={{ marginLeft: 24, fontWeight: 600, fontSize: 16 }}>Ukupno: {order.totalRsd.toLocaleString('sr-RS')} RSD</span>
        </div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h3 style={cardTitle}>Promeni status</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ORDER_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => mutation.mutate(s)}
              disabled={order.status === s || mutation.isPending}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                border: order.status === s ? '2px solid #534AB7' : '1px solid #d3d1c7',
                background: order.status === s ? '#eeedfe' : '#fff',
                fontWeight: order.status === s ? 600 : 400,
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', padding: 20 }
const cardTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }
const infoRow: React.CSSProperties = { margin: '0 0 6px', fontSize: 14 }
const infoLabel: React.CSSProperties = { color: '#888', marginRight: 8 }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }
