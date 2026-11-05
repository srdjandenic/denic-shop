export type StockCheckItem = {
  variantId: string
  quantity: number
  stock: number
}

export type StockError = {
  variantId: string
  requested: number
  available: number
}

export function checkStock(items: StockCheckItem[]): StockError[] {
  return items
    .filter(item => item.quantity > item.stock)
    .map(item => ({ variantId: item.variantId, requested: item.quantity, available: item.stock }))
}

export function decrementStock(stock: number, quantity: number): number {
  if (quantity <= 0) throw new Error('Kolicina mora biti pozitivna')
  if (quantity > stock) throw new Error(`Nema dovoljno zaliha. Trazeno: ${quantity}, dostupno: ${stock}`)
  return stock - quantity
}

export function incrementStock(stock: number, quantity: number): number {
  if (quantity <= 0) throw new Error('Kolicina mora biti pozitivna')
  return stock + quantity
}
