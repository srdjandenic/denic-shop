import { useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

type Variant = {
  id?: string
  sku: string
  name: string
  priceRsd: number
  compareAtPriceRsd?: number
  stock: number
  attributes: Record<string, string>
  active: boolean
}

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function ProductFormPage() {
  const { id } = useParams({ from: '/_dashboard/products/$id' }) as { id?: string }
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: existing, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.products.get(id!),
    enabled: !isNew,
  })
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })

  const p = existing as any

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [published, setPublished] = useState(false)
  const [hasVariants, setHasVariants] = useState(false)
  const [variants, setVariants] = useState<Variant[]>([
    { sku: '', name: '', priceRsd: 0, stock: 0, attributes: {}, active: true },
  ])
  const [initialized, setInitialized] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mediaList, setMediaList] = useState<any[]>([])

  if (!isNew && !isLoading && p && !initialized) {
    setName(p.name ?? '')
    setSlug(p.slug ?? '')
    setDescription(p.description ?? '')
    setCategoryId(p.categoryId ?? '')
    setPublished(p.published ?? false)
    setHasVariants(p.hasVariants ?? false)
    setVariants(p.productVariants?.length
      ? p.productVariants.map((v: any) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          priceRsd: v.priceRsd,
          compareAtPriceRsd: v.compareAtPriceRsd,
          stock: v.stock,
          attributes: v.attributes ?? {},
          active: v.active,
        }))
      : [{ sku: '', name: '', priceRsd: 0, stock: 0, attributes: {}, active: true }])
    setMediaList(p.productMedia ?? [])
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        slug: slug || slugify(name),
        description,
        categoryId: categoryId || undefined,
        published,
        hasVariants,
        variants: variants.map(v => ({
          sku: v.sku || `${slugify(name)}-1`,
          name: v.name || name,
          priceRsd: Number(v.priceRsd),
          compareAtPriceRsd: v.compareAtPriceRsd ? Number(v.compareAtPriceRsd) : undefined,
          stock: Number(v.stock),
          attributes: v.attributes,
          active: v.active,
        })),
      }
      if (isNew) return api.products.create(payload)
      return api.products.update(id!, payload)
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ['products'] })
      if (isNew && result?.id) {
        navigate({ to: '/products/$id', params: { id: result.id } })
      }
    },
  })

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean) => {
    const file = e.target.files?.[0]
    if (!file || !id || isNew) return
    setUploading(true)
    try {
      const result = await api.products.uploadMedia(id, file, isCover) as any
      setMediaList(prev => [...prev, result])
      qc.invalidateQueries({ queryKey: ['product', id] })
    } finally {
      setUploading(false)
    }
  }

  const updateVariant = (i: number, field: keyof Variant, value: unknown) => {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v))
  }

  const addVariant = () => {
    setVariants(prev => [...prev, { sku: '', name: '', priceRsd: 0, stock: 0, attributes: {}, active: true }])
  }

  const removeVariant = (i: number) => {
    setVariants(prev => prev.filter((_, idx) => idx !== i))
  }

  if (!isNew && isLoading) return <p>Učitavanje…</p>

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
          {isNew ? 'Novi proizvod' : `Izmena: ${p?.name ?? ''}`}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigate({ to: '/products' })} style={btnSecondary}>
            Odustani
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !name}
            style={btnPrimary}
          >
            {saveMutation.isPending ? 'Čuvanje…' : 'Sačuvaj'}
          </button>
        </div>
      </div>

      {saveMutation.isError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 16, color: '#b91c1c' }}>
          {(saveMutation.error as Error).message}
        </div>
      )}
      {saveMutation.isSuccess && !isNew && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 12, marginBottom: 16, color: '#166534' }}>
          Sačuvano.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {/* Osnovni podaci */}
        <section style={card}>
          <h3 style={cardTitle}>Osnovni podaci</h3>
          <label style={labelStyle}>
            Naziv *
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)) }}
              style={inputStyle}
              placeholder="npr. Grafička Majica"
            />
          </label>
          <label style={labelStyle}>
            Slug (URL)
            <input value={slug} onChange={e => setSlug(e.target.value)} style={inputStyle} placeholder="graficka-majica" />
          </label>
          <label style={labelStyle}>
            Opis
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ ...inputStyle, height: 100, resize: 'vertical' }}
              placeholder="Opis proizvoda…"
            />
          </label>
          <label style={labelStyle}>
            Kategorija
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={inputStyle}>
              <option value="">— bez kategorije —</option>
              {(cats as any[])?.map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
              Objavljeno (vidljivo kupcima)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={hasVariants} onChange={e => setHasVariants(e.target.checked)} />
              Ima varijante (veličine, boje…)
            </label>
          </div>
        </section>

        {/* Varijante */}
        <section style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ ...cardTitle, margin: 0 }}>Varijante i cene</h3>
            <button onClick={addVariant} style={btnSecondary}>+ Dodaj varijantu</button>
          </div>
          {variants.map((v, i) => (
            <div key={i} style={{ border: '1px solid #e9e7e1', borderRadius: 8, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={labelStyle}>
                  Naziv varijante
                  <input value={v.name} onChange={e => updateVariant(i, 'name', e.target.value)} style={inputStyle} placeholder="npr. L / Crna" />
                </label>
                <label style={labelStyle}>
                  SKU
                  <input value={v.sku} onChange={e => updateVariant(i, 'sku', e.target.value)} style={inputStyle} placeholder="MAJICA-L-CRN" />
                </label>
                <label style={labelStyle}>
                  Cena (RSD)
                  <input type="number" value={v.priceRsd} onChange={e => updateVariant(i, 'priceRsd', e.target.value)} style={inputStyle} min="0" />
                </label>
                <label style={labelStyle}>
                  Stara cena (RSD, opciono)
                  <input type="number" value={v.compareAtPriceRsd ?? ''} onChange={e => updateVariant(i, 'compareAtPriceRsd', e.target.value || undefined)} style={inputStyle} min="0" />
                </label>
                <label style={labelStyle}>
                  Zalihe
                  <input type="number" value={v.stock} onChange={e => updateVariant(i, 'stock', e.target.value)} style={inputStyle} min="0" />
                </label>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', marginBottom: 2 }}>
                    <input type="checkbox" checked={v.active} onChange={e => updateVariant(i, 'active', e.target.checked)} />
                    Aktivna
                  </label>
                  {variants.length > 1 && (
                    <button onClick={() => removeVariant(i)} style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fca5a5' }}>
                      Ukloni
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Slike — samo za postojeće proizvode */}
        {!isNew && (
          <section style={card}>
            <h3 style={cardTitle}>Slike</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              {mediaList.map((m: any) => (
                <div key={m.id} style={{ position: 'relative', width: 100, height: 100 }}>
                  <img
                    src={m.url ?? m.r2Key}
                    alt={m.alt ?? ''}
                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: m.isCover ? '2px solid #534AB7' : '1px solid #e9e7e1' }}
                  />
                  {m.isCover && (
                    <span style={{ position: 'absolute', top: 4, left: 4, background: '#534AB7', color: '#fff', fontSize: 10, padding: '2px 5px', borderRadius: 4 }}>
                      Naslovna
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <label style={{ ...btnSecondary, cursor: 'pointer', display: 'inline-block' }}>
                {uploading ? 'Upload…' : '+ Dodaj sliku'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, false)} disabled={uploading} />
              </label>
              <label style={{ ...btnSecondary, cursor: 'pointer', display: 'inline-block' }}>
                {uploading ? 'Upload…' : '+ Naslovna slika'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, true)} disabled={uploading} />
              </label>
            </div>
            {isNew && <p style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Slike možeš dodati nakon što sačuvaš proizvod.</p>}
          </section>
        )}
      </div>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', padding: 20 }
const cardTitle: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: '#1a1a1a', marginBottom: 12 }
const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 14, background: '#fafaf9', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontWeight: 500 }
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#1a1a1a', border: '1px solid #d3d1c7', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
