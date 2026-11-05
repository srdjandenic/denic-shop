import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function SettingsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => api.settings.get() })
  const { data: pmData } = useQuery({ queryKey: ['payment-methods'], queryFn: () => api.settings.paymentMethods.list() })

  const settings = (data as any) ?? {}
  const paymentMethods = (pmData as any[]) ?? []

  const [shopName, setShopName] = useState('')
  const [shippingFlat, setShippingFlat] = useState('')
  const [freeShippingAbove, setFreeShippingAbove] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [pmEdits, setPmEdits] = useState<Record<string, any>>({})

  if (!isLoading && settings.name && !initialized) {
    setShopName(settings.name ?? '')
    setShippingFlat(String(settings.settings?.shippingFlatRsd ?? 490))
    setFreeShippingAbove(String(settings.settings?.freeShippingAboveRsd ?? 5000))
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => api.settings.update({
      name: shopName,
      settings: {
        ...settings.settings,
        shippingFlatRsd: Number(shippingFlat),
        freeShippingAboveRsd: Number(freeShippingAbove),
      },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })

  const savePmMutation = useMutation({
    mutationFn: (pm: any) => api.settings.paymentMethods.update(pm.id, {
      active: pmEdits[pm.id]?.active ?? pm.active,
      config: { ...pm.config, ...pmEdits[pm.id]?.config },
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-methods'] }),
  })

  const updatePmEdit = (pmId: string, field: string, value: unknown) => {
    setPmEdits(prev => ({ ...prev, [pmId]: { ...prev[pmId], [field]: value } }))
  }

  const updatePmConfig = (pmId: string, configField: string, value: unknown) => {
    setPmEdits(prev => ({
      ...prev,
      [pmId]: { ...prev[pmId], config: { ...(prev[pmId]?.config ?? {}), [configField]: value } },
    }))
  }

  const pmLabel: Record<string, string> = {
    ips_qr: 'IPS QR (uplata na račun)',
    cod: 'Pouzećem (gotovina pri isporuci)',
    bank_transfer: 'Bankovna doznaka',
  }

  if (isLoading) return <p>Učitavanje…</p>

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 500 }}>Podešavanja prodavnice</h1>

      {/* Podaci prodavnice */}
      <section style={card}>
        <h3 style={cardTitle}>Podaci prodavnice</h3>
        <label style={labelStyle}>
          Naziv prodavnice
          <input value={shopName} onChange={e => setShopName(e.target.value)} style={inputStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>
            Cena dostave (RSD)
            <input type="number" value={shippingFlat} onChange={e => setShippingFlat(e.target.value)} style={inputStyle} min="0" />
          </label>
          <label style={labelStyle}>
            Besplatna dostava od (RSD)
            <input type="number" value={freeShippingAbove} onChange={e => setFreeShippingAbove(e.target.value)} style={inputStyle} min="0" />
          </label>
        </div>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} style={{ ...btnPrimary, marginTop: 4 }}>
          {saveMutation.isPending ? 'Čuvanje…' : 'Sačuvaj podešavanja'}
        </button>
        {saveMutation.isSuccess && <span style={{ marginLeft: 12, fontSize: 13, color: '#166534' }}>Sačuvano.</span>}
      </section>

      {/* Načini plaćanja */}
      <section style={{ ...card, marginTop: 16 }}>
        <h3 style={cardTitle}>Načini plaćanja</h3>
        {paymentMethods.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>Nema podešenih načina plaćanja.</p>
        ) : (
          paymentMethods.map((pm: any) => {
            const edit = pmEdits[pm.id] ?? {}
            const isActive = edit.active ?? pm.active
            return (
              <div key={pm.id} style={{ border: '1px solid #e9e7e1', borderRadius: 8, padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => updatePmEdit(pm.id, 'active', e.target.checked)}
                    />
                    {pmLabel[pm.type] ?? pm.type}
                  </label>
                  <button onClick={() => savePmMutation.mutate(pm)} disabled={savePmMutation.isPending} style={btnSecondary}>
                    Sačuvaj
                  </button>
                </div>

                {pm.type === 'ips_qr' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={labelStyle}>
                      Naziv primaoca
                      <input
                        value={(edit.config?.recipientName ?? pm.config?.recipientName) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'recipientName', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      Broj računa (18 cifara)
                      <input
                        value={(edit.config?.accountNumber ?? pm.config?.accountNumber) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'accountNumber', e.target.value.replace(/-/g, ''))}
                        style={inputStyle}
                        placeholder="105000000328120183"
                      />
                    </label>
                    <label style={labelStyle}>
                      Model poziva
                      <input
                        value={(edit.config?.model ?? pm.config?.model) ?? '97'}
                        onChange={e => updatePmConfig(pm.id, 'model', e.target.value)}
                        style={inputStyle}
                        placeholder="97"
                      />
                    </label>
                    <label style={labelStyle}>
                      Prefiks reference
                      <input
                        value={(edit.config?.referencePrefix ?? pm.config?.referencePrefix) ?? '11'}
                        onChange={e => updatePmConfig(pm.id, 'referencePrefix', e.target.value)}
                        style={inputStyle}
                        placeholder="11"
                      />
                    </label>
                  </div>
                )}

                {pm.type === 'cod' && (
                  <label style={labelStyle}>
                    Maks. iznos pouzećem (RSD)
                    <input
                      type="number"
                      value={(edit.config?.maxAmountRsd ?? pm.config?.maxAmountRsd) ?? 50000}
                      onChange={e => updatePmConfig(pm.id, 'maxAmountRsd', Number(e.target.value))}
                      style={{ ...inputStyle, width: 200 }}
                      min="0"
                    />
                  </label>
                )}

                {pm.type === 'bank_transfer' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={labelStyle}>
                      Naziv primaoca
                      <input
                        value={(edit.config?.recipientName ?? pm.config?.recipientName) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'recipientName', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      Broj računa
                      <input
                        value={(edit.config?.accountNumber ?? pm.config?.accountNumber) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'accountNumber', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      Naziv banke
                      <input
                        value={(edit.config?.bankName ?? pm.config?.bankName) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'bankName', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                    <label style={labelStyle}>
                      SWIFT/BIC (opciono)
                      <input
                        value={(edit.config?.swiftCode ?? pm.config?.swiftCode) ?? ''}
                        onChange={e => updatePmConfig(pm.id, 'swiftCode', e.target.value)}
                        style={inputStyle}
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })
        )}
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', padding: 20 }
const cardTitle: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: '#1a1a1a', marginBottom: 10 }
const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 14, background: '#fafaf9', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#1a1a1a', border: '1px solid #d3d1c7', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }
