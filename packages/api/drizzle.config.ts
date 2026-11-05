import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: '../core/src/schema/index.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
})
