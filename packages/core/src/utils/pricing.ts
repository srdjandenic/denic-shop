export type CartItem = {
  priceRsd: number
  quantity: number
}

export type ShippingConfig = {
  flatRsd: number
  freeAboveRsd: number
}

export function calcSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.priceRsd * item.quantity, 0)
}

export function calcShipping(subtotal: number, config: ShippingConfig): number {
  if (subtotal >= config.freeAboveRsd) return 0
  return config.flatRsd
}

export function calcTotal(subtotal: number, shippingRsd: number): number {
  return subtotal + shippingRsd
}

export function applyPercentDiscount(priceRsd: number, discountPercent: number): number {
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error(`Popust mora biti izmedju 0 i 100. Primljeno: ${discountPercent}`)
  }
  return Math.round(priceRsd * (1 - discountPercent / 100))
}
