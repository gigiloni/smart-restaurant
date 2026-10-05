import { computed, Injectable, signal } from '@angular/core';
import { CartLine, MAX_CART_ITEMS, restoreCart } from './cart-state';

const STORAGE_KEY = 'sr.cart.v1';
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<CartLine[]>(this.restore());
  readonly lines = this.state.asReadonly();
  readonly count = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly submitting = signal(false);
  readonly storageWarning = signal('');
  add(productId: number): void {
    if (this.submitting() || this.count() >= MAX_CART_ITEMS) return;
    const existing = this.lines().find((line) => line.productId === productId);
    if (existing && existing.quantity >= 99) return;
    this.save(
      existing
        ? this.lines().map((line) =>
            line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...this.lines(), { productId, quantity: 1 }],
    );
  }
  decrease(productId: number): void {
    if (this.submitting()) return;
    this.save(
      this.lines().flatMap((line) =>
        line.productId !== productId
          ? [line]
          : line.quantity > 1
            ? [{ ...line, quantity: line.quantity - 1 }]
            : [],
      ),
    );
  }
  remove(productId: number): void {
    if (!this.submitting()) this.save(this.lines().filter((line) => line.productId !== productId));
  }
  clear(): void {
    this.save([]);
  }
  quantity(productId: number): number {
    return this.lines().find((line) => line.productId === productId)?.quantity ?? 0;
  }
  canAdd(productId: number): boolean {
    return (
      !this.submitting() &&
      this.count() < MAX_CART_ITEMS &&
      (this.lines().find((line) => line.productId === productId)?.quantity ?? 0) < 99
    );
  }
  private restore(): CartLine[] {
    try {
      return restoreCart(sessionStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  }
  private save(lines: CartLine[]): void {
    this.state.set(lines);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lines }));
      this.storageWarning.set('');
    } catch {
      this.storageWarning.set(
        'Der Browser kann den Warenkorb nicht speichern. Beim Neuladen kann er verloren gehen.',
      );
    }
  }
}
