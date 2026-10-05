export interface CartLine {
  productId: number;
  quantity: number;
}
export const MAX_CART_ITEMS = 200;
export function restoreCart(value: string | null): CartLine[] {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('lines' in parsed) ||
      !Array.isArray(parsed.lines)
    )
      return [];
    const lines: CartLine[] = [];
    for (const entry of parsed.lines) {
      if (
        !entry ||
        typeof entry !== 'object' ||
        !Number.isSafeInteger(entry.productId) ||
        entry.productId < 1 ||
        !Number.isSafeInteger(entry.quantity) ||
        entry.quantity < 1 ||
        entry.quantity > 99 ||
        lines.some((line) => line.productId === entry.productId)
      )
        return [];
      lines.push({ productId: entry.productId, quantity: entry.quantity });
    }
    return lines.reduce((sum, line) => sum + line.quantity, 0) <= MAX_CART_ITEMS ? lines : [];
  } catch {
    return [];
  }
}
export function priceInCents(price: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(price)) throw new Error('Ungültiger Produktpreis');
  const [whole, fraction = ''] = price.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
