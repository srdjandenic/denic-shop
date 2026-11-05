import { sign, verify } from 'hono/jwt'
import type { UserRole } from '@denic-shop/core/types'

export type JwtPayload = {
  sub: string       // user id
  tenantId: string
  role: UserRole
  exp: number
}

const TOKEN_TTL_SECONDS = 60 * 60 * 8 // 8 sati

export async function signToken(payload: Omit<JwtPayload, 'exp'>, secret: string): Promise<string> {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS },
    secret
  )
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  const payload = await verify(token, secret, 'HS256') as JwtPayload
  return payload
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password)
  return computed === hash
}
