import { MessageService } from 'primeng/api';
import { HttpErrorResponse } from '@angular/common/http';
import { apiError } from './api-error';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth-service';
import { LiveService } from './live-service';
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
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  readonly cart = inject(CartService);
  readonly catalog = inject(ProductService);
  readonly tables = inject(TableService);
  readonly auth = inject(AuthService);
  private readonly live = inject(LiveService);
  constructor() {
    let identity = '';
    effect(() => {
      const viewer = this.auth.viewer();
      const current =
        viewer?.kind === 'guest'
          ? `guest:${viewer.tableSessionId}`
          : viewer?.kind === 'staff'
            ? `staff:${viewer.employeeId}:${viewer.role}`
            : '';
      if (identity && identity !== current) this.receipt.set(null);
      identity = current;
    });
  }
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
      (!!this.auth.guest() || this.auth.hasRole('ADMIN', 'SERVICE')) &&
      !this.unavailable(),
  );

  submit(): void {
    if (!this.canSubmit()) return;
    const table = this.tables.selectedTable();
    if (!table) return;
    const viewer = this.auth.viewer();
    const scope =
      viewer?.kind === 'guest'
        ? `guest:${viewer.tableSessionId}`
        : viewer?.kind === 'staff'
          ? `staff:${viewer.employeeId}:${viewer.role}`
          : '';
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
          const current = this.auth.viewer();
          const currentScope =
            current?.kind === 'guest'
              ? `guest:${current.tableSessionId}`
              : current?.kind === 'staff'
                ? `staff:${current.employeeId}:${current.role}`
                : '';
          if (scope !== currentScope) return;
          // The committed response is authoritative if a price changed during checkout.
          const receiptItems = new Map<number, OrderReceipt['items'][number]>();
          for (const item of order.orderItems) {
            const line = receiptItems.get(item.productId) ?? {
              name: item.product.name,
              quantity: 0,
              subtotal: 0,
            };
            line.quantity++;
            line.subtotal += priceInCents(item.product.price);
            receiptItems.set(item.productId, line);
          }
          this.cart.clear();
          this.receipt.set({
            id: order.id,
            tableNumber: order.table.tableNumber,
            total: [...receiptItems.values()].reduce((sum, item) => sum + item.subtotal, 0),
            items: [...receiptItems.values()],
          });
          this.live.reload();
          this.messages.add({
            severity: 'success',
            summary: 'Bestellung aufgenommen',
            detail: `Bestellung #${order.id} für Tisch ${order.table.tableNumber}.`,
          });
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 0 || error.status >= 500)
            this.showError(
              'Die Bestellung konnte nicht bestätigt werden. Bitte beim Service nachfragen, ob sie eingegangen ist, bevor Sie erneut bestellen.',
            );
          else if (error.status === 401 || error.status === 403)
            this.showError(
              'Die Bestellung benötigt einen gültigen Tischzugang. Bitte Ihren Tisch auswählen oder den Service ansprechen.',
            );
          else this.showError(apiError(error, 'Die Bestellung wurde abgelehnt.'));
        },
      });
  }
}
