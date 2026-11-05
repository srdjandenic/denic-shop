import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const ROLES = ['owner', 'admin', 'staff'] as const
const ROLE_LABELS: Record<string, string> = {
  owner: 'Vlasnik',
  admin: 'Administrator',
  staff: 'Zaposleni',
}

export function UsersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api.users.list() })
  const users = (data as any[]) ?? []

  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<string>('staff')
  const [showInvite, setShowInvite] = useState(false)

  const inviteMutation = useMutation({
    mutationFn: () => api.users.invite({ email, name, role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setEmail(''); setName(''); setRole('staff'); setShowInvite(false)
    },
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.users.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>Korisnici</h1>
        <button onClick={() => setShowInvite(v => !v)} style={btnPrimary}>
          {showInvite ? 'Odustani' : '+ Pozovi korisnika'}
        </button>
      </div>

      {showInvite && (
        <section style={{ ...card, marginBottom: 16 }}>
          <h3 style={cardTitle}>Pozovi novog korisnika</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <label style={labelStyle}>
              Email *
              <input value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} type="email" placeholder="korisnik@email.rs" />
            </label>
            <label style={labelStyle}>
              Ime *
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ime Prezime" />
            </label>
          </div>
          <label style={{ ...labelStyle, maxWidth: 240 }}>
            Uloga
            <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          <button
            onClick={() => inviteMutation.mutate()}
            disabled={!email || !name || inviteMutation.isPending}
            style={btnPrimary}
          >
            {inviteMutation.isPending ? 'Pozivanje…' : 'Pošalji pozivnicu'}
          </button>
          {inviteMutation.isError && (
            <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>
              {(inviteMutation.error as Error).message}
            </p>
          )}
        </section>
      )}

      <section style={card}>
        <h3 style={cardTitle}>Svi korisnici</h3>
        {isLoading ? (
          <p style={{ color: '#888' }}>Učitavanje…</p>
        ) : users.length === 0 ? (
          <p style={{ color: '#888', fontSize: 14 }}>Nema korisnika.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Ime', 'Email', 'Uloga', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#888', borderBottom: '1px solid #e9e7e1' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f5f5f4' }}>
                  <td style={{ padding: '10px 12px', fontSize: 14, fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 14, color: '#888' }}>{u.email}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select
                      value={u.role}
                      onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                      style={{ ...inputStyle, padding: '4px 8px', fontSize: 13 }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {u.role !== 'owner' && (
                      <button
                        onClick={() => window.confirm(`Ukloniti korisnika "${u.name}"?`) && deleteMutation.mutate(u.id)}
                        style={{ ...btnSecondary, color: '#dc2626', borderColor: '#fca5a5', fontSize: 12 }}
                      >
                        Ukloni
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e9e7e1', padding: 20 }
const cardTitle: React.CSSProperties = { margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: '#1a1a1a', marginBottom: 10 }
const inputStyle: React.CSSProperties = { padding: '8px 10px', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 14, background: '#fafaf9', outline: 'none' }
const btnPrimary: React.CSSProperties = { background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#1a1a1a', border: '1px solid #d3d1c7', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }
