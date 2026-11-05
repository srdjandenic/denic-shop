import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export function CategoriesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => api.categories.list() })
  const categories = (data as any[]) ?? []

  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  function slugify(s: string) {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  const createMutation = useMutation({
    mutationFn: () => api.categories.create({ name, slug: slugify(name) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName('') },
  })

  const updateMutation = useMutation({
    mutationFn: () => api.categories.update(editId!, { name: editName, slug: slugify(editName) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setEditId(null); setEditName('') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.categories.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 500 }}>Kategorije</h1>

      <section style={card}>
        <h3 style={cardTitle}>Nova kategorija</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name && createMutation.mutate()}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Naziv kategorije"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            style={btnPrimary}
          >
            {createMutation.isPending ? '…' : 'Dodaj'}
          </button>
        </div>
      </section>

      <section style={{ ...card, marginTop: 16 }}>
        <h3 style={cardTitle}>Sve kategorije</h3>
        {isLoading ? (
          <p style={{ color: '#888' }}>Učitavanje…</p>
        ) : categories.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>Nema kategorija.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {categories.map((cat: any) => (
              <li key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #f5f5f4' }}>
                {editId === cat.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && editName && updateMutation.mutate()}
                      style={{ ...inputStyle, flex: 1 }}
                      autoFocus
                    />
                    <button onClick={() => updateMutation.mutate()} disabled={!editName || updateMutation.isPending} style={btnPrimary}>
                      {updateMutation.isPending ? '…' : 'Sačuvaj'}
                    </button>
                    <button onClick={() => setEditId(null)} style={btnSecondary}>Odustani</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 14 }}>{cat.name}</span>
                    <span style={{ fontSize: 12, color: '#888', marginRight: 8 }}>{cat.slug}</span>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }} style={btnSecondary}>Izmeni</button>
                    <button
                      onClick={() => window.confirm(`Obrisati kategoriju "${cat.name}"?`) && deleteMutation.mutate(cat.id)}
                      style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      Briši
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', padding: 20 }
const cardTitle: React.CSSProperties = { margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }
const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 14, background: '#fafaf9', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#1a1a1a', border: '1px solid #d3d1c7', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }
