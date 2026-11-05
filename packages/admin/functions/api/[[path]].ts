const API_WORKER = 'https://denic-shop-api.denicdesign.workers.dev'

export async function onRequest(ctx: { request: Request }): Promise<Response> {
  const url = new URL(ctx.request.url)
  const target = `${API_WORKER}${url.pathname}${url.search}`

  const headers = new Headers(ctx.request.headers)
  headers.delete('host')

  const response = await fetch(target, {
    method: ctx.request.method,
    headers,
    body: ['GET', 'HEAD'].includes(ctx.request.method) ? undefined : ctx.request.body,
  })

  const resHeaders = new Headers(response.headers)
  resHeaders.set('access-control-allow-origin', url.origin)
  resHeaders.set('access-control-allow-credentials', 'true')

  return new Response(response.body, {
    status: response.status,
    headers: resHeaders,
  })
}
