import { Outlet, Link, useNavigate } from '@tanstack/react-router'
import { api } from '../lib/api'

export function DashboardLayout() {
  const navigate = useNavigate()

  async function handleLogout() {
    await api.auth.logout()
    navigate({ to: '/login' })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={navStyle}>
        <div style={{ padding: '24px 20px 16px', fontWeight: 600, fontSize: 16 }}>Denic Shop</div>
        <NavLink to="/orders">Porudžbine</NavLink>
        <NavLink to="/products">Proizvodi</NavLink>
        <button onClick={handleLogout} style={logoutStyle}>Odjava</button>
      </nav>
      <main style={{ flex: 1, padding: 32, background: '#f5f5f4', minHeight: '100vh' }}>
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{ display: 'block', padding: '10px 20px', fontSize: 14, color: '#3d3d3a', textDecoration: 'none' }}
      activeProps={{ style: { display: 'block', padding: '10px 20px', fontSize: 14, color: '#1a1a1a', fontWeight: 600, background: '#ece9e3', borderRadius: 8, margin: '0 8px', textDecoration: 'none' } }}
    >
      {children}
    </Link>
  )
}

const navStyle: React.CSSProperties = { width: 200, background: '#fff', borderRight: '1px solid #e9e7e1', display: 'flex', flexDirection: 'column', gap: 2 }
const logoutStyle: React.CSSProperties = { marginTop: 'auto', margin: '8px 20px 20px', padding: '8px 12px', background: 'none', border: '1px solid #d3d1c7', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#5f5e5a' }
