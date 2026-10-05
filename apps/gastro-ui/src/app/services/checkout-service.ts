import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { CartService } from './cart-service';
import { priceInCents } from './cart-state';
import { ProductService } from './product-service';
import { OrderService } from './order-service';
import { TableService } from './table-service';

export interface OrderReceipt {
  id: number;
  tableNumber: number;
  total: number;
  items: { name: string; quantity: number; subtotal: number }[];
}
@Injectable({ providedIn: 'root' })
export class CheckoutService {
  readonly cart = inject(CartService);
  readonly catalog = inject(ProductService);
  readonly tables = inject(TableService);
  private readonly orders = inject(OrderService);
  readonly error = signal('');
  readonly receipt = signal<OrderReceipt | null>(null);
  readonly rows = computed(() =>
    this.cart.lines().map((line) => {
      const product = this.catalog.products().find((product) => product.id === line.productId);
      return {
        ...line,
        product,
        subtotal: product ? priceInCents(product.price) * line.quantity : 0,
      };
    }),
  );
  readonly total = computed(() => this.rows().reduce((sum, row) => sum + row.subtotal, 0));
  readonly unavailable = computed(() => this.rows().some((row) => !row.product));
  readonly canSubmit = computed(
    () =>
      this.cart.count() > 0 &&
      !this.cart.submitting() &&
      !this.catalog.loading() &&
      !this.catalog.error() &&
      !this.tables.loading() &&
      !this.tables.error() &&
      !!this.tables.selectedTable() &&
      !this.unavailable(),
  );

  submit(): void {
    if (!this.canSubmit()) return;
    const table = this.tables.selectedTable();
    if (!table) return;
    const receiptItems = this.rows().map((row) => ({
      name: row.product?.name ?? '',
      quantity: row.quantity,
      subtotal: row.subtotal,
    }));
    const total = this.total();
    const items = this.cart
      .lines()
      .flatMap((line) =>
        Array.from({ length: line.quantity }, () => ({ productId: line.productId })),
      );
    this.cart.submitting.set(true);
    this.error.set('');
    this.orders
      .createOrder({ tableId: table.id, items })
      .pipe(finalize(() => this.cart.submitting.set(false)))
      .subscribe({
        next: (order) => {
          this.cart.clear();
          this.receipt.set({
            id: order.id,
            tableNumber: order.table.tableNumber,
            total,
            items: receiptItems,
          });
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 0 || error.status >= 500)
            this.error.set(
              'Die Bestellung konnte nicht bestätigt werden. Bitte beim Service nachfragen, ob sie eingegangen ist, bevor Sie erneut bestellen. Ihr Warenkorb bleibt erhalten.',
            );
          else if (error.status === 401 || error.status === 403)
            this.error.set(
              'Die Bestellung benötigt einen gültigen Tischzugang. Bitte den QR-Code am Tisch scannen oder den Service ansprechen. Ihr Warenkorb bleibt erhalten.',
            );
          else
            this.error.set(
              'Die Bestellung wurde abgelehnt. Bitte Tisch und Speisekarte erneut prüfen. Ihr Warenkorb bleibt erhalten.',
            );
        },
      });
  }
}
