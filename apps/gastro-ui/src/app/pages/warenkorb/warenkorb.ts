import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CartService } from '../../services/cart-service';
import { priceInCents } from '../../services/cart-state';
import { ProductService } from '../../services/product-service';
import { OrderService } from '../../services/order-service';
import { TableService } from '../../services/table-service';
@Component({
  selector: 'app-warenkorb',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './warenkorb.html',
  styleUrl: './warenkorb.css',
})
export class Warenkorb {
  protected readonly cart = inject(CartService);
  protected readonly catalog = inject(ProductService);
  protected readonly tables = inject(TableService);
  private readonly orders = inject(OrderService);
  protected readonly error = signal('');
  protected readonly confirmation = signal<{ id: number; tableNumber: number } | null>(null);
  protected readonly rows = computed(() =>
    this.cart.lines().map((line) => {
      const product = this.catalog.products().find((product) => product.id === line.productId);
      return {
        ...line,
        product,
        subtotal: product ? priceInCents(product.price) * line.quantity : 0,
      };
    }),
  );
  protected readonly total = computed(() =>
    this.rows().reduce((sum, row) => sum + row.subtotal, 0),
  );
  protected readonly unavailable = computed(() => this.rows().some((row) => !row.product));
  protected readonly canSubmit = computed(
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
  constructor() {
    this.catalog.load(true);
    this.tables.getTables();
  }
  submit(): void {
    if (!this.canSubmit()) return;
    const table = this.tables.selectedTable();
    if (!table) return;
    const items = this.cart
      .lines()
      .flatMap((line) =>
        Array.from({ length: line.quantity }, () => ({ productId: line.productId })),
      );
    this.cart.submitting.set(true);
    this.error.set('');
    this.confirmation.set(null);
    this.orders
      .createOrder({ tableId: table.id, items })
      .pipe(finalize(() => this.cart.submitting.set(false)))
      .subscribe({
        next: (order) => {
          this.cart.clear();
          this.confirmation.set({ id: order.id, tableNumber: order.table.tableNumber });
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
