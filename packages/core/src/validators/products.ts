import { z } from 'zod'

export const CURRENCY_CODE = z.enum(['RSD', 'EUR'])

export const VariantPriceSchema = z.object({
  currencyCode: CURRENCY_CODE,
  amount: z.number().int().min(0),
  compareAtAmount: z.number().int().min(0).optional(),
})

export const VariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().default(''),
  name: z.string().default(''),
  prices: z.array(VariantPriceSchema).default([]),
  requiresShipping: z.boolean().default(true),
  allowBackorder: z.boolean().default(false),
  weight: z.number().int().min(0).optional(),
  weightUnit: z.enum(['g', 'kg']).default('g'),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const ProductOptionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  values: z.array(z.object({
    id: z.string().uuid().optional(),
    value: z.string().min(1),
    sortOrder: z.number().int().default(0),
  })).default([]),
})

export const CreateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug sme da sadrži samo mala slova, brojeve i crtice').optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  productType: z.enum(['physical', 'digital', 'service']).default('physical'),
  hasVariants: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  variants: z.array(VariantSchema).min(1),
  options: z.array(ProductOptionSchema).default([]),
})

export const UpdateProductSchema = CreateProductSchema.partial()

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type VariantInput = z.infer<typeof VariantSchema>
export type VariantPriceInput = z.infer<typeof VariantPriceSchema>
