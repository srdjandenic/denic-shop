import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.auth.login(email, password)
      navigate({ to: '/orders' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f4' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 40, width: 360, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <h1 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 500 }}>Prijava</h1>
        {error && (
          <p style={{ color: '#a32d2d', background: '#fcebeb', borderRadius: 8, padding: '10px 14px', margin: '0 0 16px', fontSize: 14 }}>
            {error}
          </p>
        )}
        <label style={labelStyle}>
          Email
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label style={labelStyle}>
          Lozinka
          <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </label>
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Prijava…' : 'Prijavi se'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16, fontSize: 14, fontWeight: 500, color: '#3d3d3a' }
const inputStyle: React.CSSProperties = { border: '1px solid #d3d1c7', borderRadius: 8, padding: '10px 12px', fontSize: 15, fontWeight: 400, outline: 'none' }
const btnStyle: React.CSSProperties = { width: '100%', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 }
