import { Hono } from 'hono'
import type { Env } from '../lib/env'

export const mediaRoutes = new Hono<{ Bindings: Env }>()

mediaRoutes.get('/*', async (c) => {
  const r2Key = c.req.path.replace('/api/v1/media/', '')
  if (!r2Key) return c.json({ error: 'Nije pronađen' }, 404)

  const object = await c.env.MEDIA.get(r2Key)
  if (!object) return c.json({ error: 'Nije pronađen' }, 404)

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('cache-control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
})
