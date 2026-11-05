import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { LoginPage } from './pages/LoginPage'
import { DashboardLayout } from './pages/DashboardLayout'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { ProductsPage } from './pages/ProductsPage'

const rootRoute = createRootRoute({ component: Outlet })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardLayout,
})

const ordersRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: 'orders',
  component: OrdersPage,
})

const orderDetailRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: 'orders/$id',
  component: OrderDetailPage,
})

const productsRoute = createRoute({
  getParentRoute: () => dashboardRoute,
  path: 'products',
  component: ProductsPage,
})

export const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute.addChildren([ordersRoute, orderDetailRoute, productsRoute]),
])
