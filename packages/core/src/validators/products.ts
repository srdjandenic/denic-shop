import { z } from 'zod'

export const VariantSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().default(''),
  name: z.string().default(''),
  priceRsd: z.number().int().min(0).default(0),
  compareAtPriceRsd: z.number().int().positive().optional(),
  stock: z.number().int().min(0).default(0),
  attributes: z.record(z.string()).default({}),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
})

export const CreateProductSchema = z.object({
  categoryId: z.string().uuid().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug sme da sadrži samo mala slova, brojeve i crtice'),
  name: z.string().min(1),
  description: z.string().optional(),
  hasVariants: z.boolean().default(false),
  published: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  variants: z.array(VariantSchema).min(1),
})

export const UpdateProductSchema = CreateProductSchema.partial()

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type VariantInput = z.infer<typeof VariantSchema>
