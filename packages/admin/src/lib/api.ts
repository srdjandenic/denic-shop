const BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const json = await res.json() as { data?: T; error?: string }
  if (!res.ok) throw new Error(json.error ?? 'Greška')
  return json.data as T
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  orders: {
    list: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params).toString()
      return request(`/orders${q ? `?${q}` : ''}`)
    },
    get: (id: string) => request(`/orders/${id}`),
    updateStatus: (id: string, body: { status: string; trackingNumber?: string }) =>
      request(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify(body) }),
    ipsQr: (id: string) => request(`/orders/${id}/ips-qr`),
    exportCsv: () => fetch(`${BASE}/orders/export/csv`, { credentials: 'include' }),
  },
  products: {
    list: () => request('/products'),
    get: (id: string) => request(`/products/${id}`),
    create: (data: unknown) =>
      request('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: unknown) =>
      request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/products/${id}`, { method: 'DELETE' }),
    uploadMedia: async (productId: string, file: File, isCover: boolean) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('isCover', String(isCover))
      const res = await fetch(`${BASE}/products/${productId}/media`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      })
      const json = await res.json() as { data?: unknown; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Greška pri uploadu')
      return json.data
    },
    deleteMedia: (productId: string, mediaId: string) =>
      request(`/products/${productId}/media/${mediaId}`, { method: 'DELETE' }),
  },
  categories: {
    list: () => request<unknown[]>('/categories'),
    create: (data: { name: string; slug: string; parentId?: string }) =>
      request('/categories', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; slug?: string }) =>
      request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/categories/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request('/settings'),
    update: (data: unknown) => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    paymentMethods: {
      list: () => request('/settings/payment-methods'),
      update: (id: string, data: unknown) =>
        request(`/settings/payment-methods/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    },
  },
  users: {
    list: () => request('/users'),
    invite: (data: { email: string; name: string; role: string }) =>
      request('/users/invite', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (id: string, role: string) =>
      request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    delete: (id: string) => request(`/users/${id}`, { method: 'DELETE' }),
  },
}
