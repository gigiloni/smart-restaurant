import { MessageService } from 'primeng/api';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { ActivatedRoute } from '@angular/router';
import { sortOrders, orderSortOptions, type OrderSort } from '../../services/order-sort';
import type { Employee, Order, OrderItem, OrderItemStatus } from '@smart-restaurant/contracts';
import { permittedOrderItemTransitions } from '@smart-restaurant/contracts/order-item-transitions';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth-service';
import { LiveService } from '../../services/live-service';
import { ProductService } from '../../services/product-service';
import { TableService } from '../../services/table-service';
import { apiError } from '../../services/api-error';
import { orderTotal, statusLabels } from '../../services/order-presentation';

@Component({
  selector: 'app-live-board',
  imports: [CurrencyPipe, FormsModule, Select, DialogModule],
  templateUrl: './live-board.html',
})
export class LiveBoard {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  readonly catalog = inject(ProductService);
  readonly tables = inject(TableService);
  private readonly http = inject(HttpClient);
  readonly search = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('table') ?? '');
  readonly tableFilter = signal<number | null>(
    Number(inject(ActivatedRoute).snapshot.queryParamMap.get('table')) || null,
  );
  readonly sort = signal<OrderSort>('newest');
  readonly sortOptions = orderSortOptions;
  newOrderOpen = false;
  readonly editOrderId = signal<number | null>(null);
  readonly editOrder = computed(
    () => this.live.orders().find((order) => order.id === this.editOrderId()) ?? null,
  );
  readonly statusFilter = signal('ALL');
  readonly statusOptions = computed(() => [
    { label: 'Alle Status', value: 'ALL' },
    ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
    ...(this.service()
      ? [
          { label: 'Unbezahlte Bestellungen', value: 'UNPAID' },
          { label: 'Bezahlte Bestellungen', value: 'CLOSED' },
        ]
      : []),
  ]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly employees = signal<Employee[]>([]);
  readonly total = orderTotal;
  readonly labels = statusLabels;
  readonly service = computed(() => this.auth.hasRole('ADMIN', 'SERVICE'));
  readonly title = computed(() =>
    this.auth.hasRole('KITCHEN')
      ? 'Küchenübersicht'
      : this.auth.hasRole('BAR')
        ? 'Barübersicht'
        : 'Bestellungen',
  );
  readonly filtered = computed(() =>
    sortOrders(
      this.live
        .orders()
        .filter(
          (order) =>
            this.statusFilter() === 'ALL' ||
            (this.statusFilter() === 'CLOSED'
              ? order.status === 'CLOSED'
              : this.statusFilter() === 'UNPAID'
                ? order.status === 'OPEN'
                : order.orderItems.some((item) => item.status === this.statusFilter())),
        )
        .filter((order) =>
          `${order.id} ${order.table.tableNumber} ${order.orderItems.map((item) => item.product.name).join(' ')}`
            .toLowerCase()
            .includes(this.search().trim().toLowerCase()),
        )
        .filter((order) => !this.tableFilter() || order.table.tableNumber === this.tableFilter()),
      this.sort(),
    ),
  );
  readonly tableOptions = computed(() =>
    this.tables
      .tablesList()
      .map((table) => ({ id: table.id, label: `Tisch ${table.tableNumber}` })),
  );
  readonly employeeOptions = computed(() =>
    this.employees().map((employee) => ({
      id: employee.id,
      label: `${employee.firstname} ${employee.lastname} (${employee.role})`,
    })),
  );
  newTableId: number | null = null;
  newProductId: number | null = null;
  newQuantity = 1;
  additions: Record<number, number> = {};
  pending: { label: string; execute: () => Promise<void> } | null = null;
  constructor() {
    effect(() => {
      const role = this.auth.staff()?.role;
      untracked(() => {
        this.pending = null;
        this.newOrderOpen = false;
        this.editOrderId.set(null);
        if (role !== 'ADMIN' && role !== 'SERVICE') {
          this.employees.set([]);
          return;
        }
        this.catalog.load();
        this.tables.getTables();
        void firstValueFrom(this.http.get<Employee[]>('/api/employees'))
          .then((employees) => this.employees.set(employees))
          .catch((error) =>
            this.showError(apiError(error, 'Mitarbeiter konnten nicht geladen werden.')),
          );
      });
    });
  }
  targets(item: OrderItem): { status: OrderItemStatus; label: string }[] {
    const role = this.auth.staff()?.role;
    return permittedOrderItemTransitions(item.status, item.product.type)
      .filter(
        (target) =>
          role === 'ADMIN' ||
          (role === 'SERVICE'
            ? ['SERVED', 'REMAKE'].includes(target.status)
            : ['OPEN', 'IN_PROGRESS', 'READY'].includes(target.status)),
      )
      .map((target) => ({
        status: target.status,
        label:
          target.kind === 'undo'
            ? `Zurück: ${this.labels[target.status]}`
            : target.status === 'IN_PROGRESS'
              ? item.status === 'REMAKE'
                ? 'Erneut zubereiten'
                : 'Zubereitung starten'
              : target.status === 'SERVED'
                ? 'Servieren'
                : target.status === 'REMAKE'
                  ? 'Neuzubereitung anfordern'
                  : this.labels[target.status],
      }));
  }
  canManage(order: Order): boolean {
    return (
      order.status === 'OPEN' &&
      this.service() &&
      (this.auth.hasRole('ADMIN') ||
        order.employeeId === null ||
        order.employeeId === this.auth.staff()?.employeeId)
    );
  }
  allServed(order: Order): boolean {
    return order.orderItems.every((item) => item.status === 'SERVED');
  }
  async perform(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      this.live.reload();
    } catch (error) {
      this.showError(apiError(error, 'Die Änderung konnte nicht übernommen werden.'));
      this.live.reload();
    } finally {
      this.busy.set(false);
    }
  }
  queue(label: string, execute: () => Promise<void>): void {
    this.error.set('');
    this.pending = { label, execute };
  }
  async confirm(): Promise<void> {
    const action = this.pending;
    await action?.execute();
    if (!this.error()) this.pending = null;
  }
  async setStatus(order: Order, item: OrderItem, status: OrderItemStatus): Promise<void> {
    await this.perform(() =>
      firstValueFrom(this.http.patch(`/api/orders/${order.id}/items/${item.id}`, { status })),
    );
  }
  async assign(order: Order, employeeId: number | null): Promise<void> {
    await this.perform(() =>
      firstValueFrom(this.http.patch(`/api/orders/${order.id}`, { employeeId })),
    );
  }
  async addItem(order: Order): Promise<void> {
    const productId = this.additions[order.id];
    if (!productId) return;
    await this.perform(() =>
      firstValueFrom(this.http.post(`/api/orders/${order.id}/items`, { productId })),
    );
  }
  async createOrder(): Promise<void> {
    if (
      !this.newTableId ||
      !this.newProductId ||
      !Number.isInteger(this.newQuantity) ||
      this.newQuantity < 1 ||
      this.newQuantity > 99
    )
      return;
    await this.perform(() =>
      firstValueFrom(
        this.http.post('/api/orders', {
          tableId: this.newTableId,
          items: Array.from({ length: this.newQuantity }, () => ({ productId: this.newProductId })),
        }),
      ),
    );
    if (!this.error()) this.newOrderOpen = false;
  }
  openNewOrder(): void {
    this.newTableId = null;
    this.newProductId = null;
    this.newQuantity = 1;
    this.error.set('');
    this.newOrderOpen = true;
  }
  requestCloseOrder(order: Order): void {
    this.queue(`Bestellung #${order.id} als bezahlt abschließen?`, () =>
      this.perform(() => firstValueFrom(this.http.post(`/api/orders/${order.id}/close`, {}))),
    );
  }
  requestRemoveOrder(order: Order): void {
    this.queue(
      `Bestellung #${order.id} stornieren? Bereits begonnene Zubereitungen werden nicht zurückgebucht.`,
      () => this.perform(() => firstValueFrom(this.http.delete(`/api/orders/${order.id}`))),
    );
  }
  requestRemoveItem(order: Order, item: OrderItem): void {
    this.queue(
      `${item.product.name} stornieren? Bereits begonnene Zubereitungen werden nicht zurückgebucht.`,
      () =>
        this.perform(() =>
          firstValueFrom(this.http.delete(`/api/orders/${order.id}/items/${item.id}`)),
        ),
    );
  }
}
