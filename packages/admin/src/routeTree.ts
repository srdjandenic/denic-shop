import { createRootRoute, createRoute, Outlet, redirect } from '@tanstack/react-router'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './pages/DashboardLayout'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ProductsPage } from './pages/ProductsPage'
import { IndexRedirect } from './pages/IndexRedirect'

export const rootRoute = createRootRoute({ component: Outlet })

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Pathless layout route — nema path, samo id.
// Svi child paths su apsolutni.
export const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_dashboard',
  component: DashboardLayout,
  beforeLoad: async () => {
    const res = await fetch('/api/v1/auth/me', { credentials: 'include' })
    if (!res.ok) {
      throw redirect({ to: '/login' })
    }
  },
})

export const indexRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/',
  component: IndexRedirect,
})

export const ordersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/orders',
  component: OrdersPage,
})

export const orderDetailRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/orders/$id',
  component: OrderDetailPage,
})

export const productsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: '/products',
  component: ProductsPage,
})

export const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute.addChildren([
    indexRoute,
    ordersRoute,
    orderDetailRoute,
    productsRoute,
  ]),
])
