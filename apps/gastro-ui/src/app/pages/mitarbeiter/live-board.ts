import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import type {
  Employee,
  Order,
  OrderItem,
  OrderItemStatus,
  TableSession,
  TableQrCode,
} from '@smart-restaurant/contracts';
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
  imports: [CurrencyPipe, FormsModule, Select],
  template: `<section>
    <div class="page-heading">
      <div>
        <span class="eyebrow">Das Restaurant im Blick</span>
        <h2>{{ title() }}</h2>
        <p>Bestellungen und Positionsstatus werden live aktualisiert.</p>
      </div>
      <div class="board-filter">
        <label for="board-search">Tisch, Bestellung oder Gericht suchen</label
        ><input
          id="board-search"
          type="search"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          placeholder="Suchen …"
        />
        <label for="board-status">Status</label
        ><p-select
          inputId="board-status"
          ariaLabel="Bestellstatus filtern"
          [options]="statusOptions()"
          optionLabel="label"
          optionValue="value"
          [ngModel]="statusFilter()"
          (ngModelChange)="statusFilter.set($event)"
          appendTo="body"
        />
      </div>
    </div>
    @if (live.error()) {
      <p class="error-message" role="status">{{ live.error() }}</p>
      <button type="button" class="secondary" (click)="live.reload()">Erneut laden</button>
    }
    @if (error()) {
      <p class="error-message" role="alert">{{ error() }}</p>
    }
    @if (pending; as action) {
      <section class="confirm-panel" role="alertdialog" aria-label="Aktion bestätigen">
        <p>{{ action.label }}</p>
        <div class="button-row">
          <button type="button" [disabled]="busy()" (click)="confirm()">Bestätigen</button
          ><button type="button" class="secondary" (click)="pending = null">Abbrechen</button>
        </div>
      </section>
    }
    @if (service()) {
      <details class="form-panel tools-panel">
        <summary>Bestellung aufnehmen & Tischzugang</summary>
        <form (ngSubmit)="createOrder()" #newOrder="ngForm">
          <div class="form-row">
            <div>
              <label for="order-table">Tisch</label
              ><p-select
                inputId="order-table"
                ariaLabel="Tisch für neue Bestellung"
                name="table"
                [options]="tableOptions()"
                optionLabel="label"
                optionValue="id"
                [(ngModel)]="newTableId"
                placeholder="Tisch wählen"
                required
                appendTo="body"
              />
            </div>
            <div>
              <label for="order-product">Produkt</label
              ><p-select
                inputId="order-product"
                ariaLabel="Produkt für neue Bestellung"
                name="product"
                [options]="catalog.products()"
                optionLabel="name"
                optionValue="id"
                [(ngModel)]="newProductId"
                placeholder="Produkt wählen"
                required
                [filter]="true"
                appendTo="body"
              />
            </div>
            <div>
              <label for="order-quantity">Menge</label
              ><input
                id="order-quantity"
                name="quantity"
                type="number"
                [(ngModel)]="newQuantity"
                min="1"
                max="99"
                required
              />
            </div>
          </div>
          <div class="button-row">
            <button type="submit" [disabled]="newOrder.invalid || busy() || catalog.loading()">
              Bestellung aufnehmen</button
            ><button
              type="button"
              class="secondary"
              [disabled]="!newTableId || busy()"
              (click)="showQr()"
            >
              Tisch-QR-Code anzeigen
            </button>
          </div>
        </form>
        @if (qrImage()) {
          <div class="qr-panel">
            <img
              [src]="qrImage()"
              alt="QR-Code für den ausgewählten Tisch"
              width="280"
              height="280"
            />
            <p>Tisch {{ qrTableNumber() }}</p>
            <a [href]="qrImage()" [download]="'bellavista-tisch-' + qrTableNumber() + '.png'"
              >QR-Code herunterladen</a
            ><a [href]="qrLink()" target="_blank" rel="noopener">Tischzugang öffnen</a>
          </div>
        }
      </details>
      <div class="session-grid">
        @for (session of live.sessions(); track session.id) {
          <article class="session-card">
            <header>
              <h3 class="panel-title">Tisch {{ session.table.tableNumber }}</h3>
              <span>{{ sessionOrders(session.id).length }} Bestellungen</span>
            </header>
            <div class="form-row">
              <p-select
                [ariaLabel]="'Zieltisch für Tisch ' + session.table.tableNumber"
                [options]="freeTables()"
                optionLabel="label"
                optionValue="id"
                [(ngModel)]="moves[session.id]"
                placeholder="Freier Zieltisch"
                appendTo="body"
              /><button
                type="button"
                class="secondary"
                [disabled]="!moves[session.id] || busy()"
                (click)="move(session)"
              >
                Verschieben
              </button>
            </div>
            <button
              type="button"
              class="secondary"
              [disabled]="!canClear(session) || busy()"
              (click)="requestCloseSession(session)"
            >
              Tisch freigeben
            </button>
          </article>
        }
      </div>
    }
    <div class="order-grid">
      @for (order of filtered(); track order.id) {
        <article class="order-panel">
          <header>
            <div>
              <span class="eyebrow"
                >Bestellung #{{ order.id }} · Tisch {{ order.table.tableNumber }}</span
              >
              <h3 class="panel-title">
                {{ order.status === 'CLOSED' ? 'Bezahlt' : 'Offene Bestellung' }}
              </h3>
            </div>
            <strong>{{ total(order) / 100 | currency: 'EUR' }}</strong>
          </header>
          @if (service()) {
            <p class="order-owner">
              {{
                order.employee
                  ? order.employee.firstname + ' ' + order.employee.lastname
                  : 'Noch nicht zugeordnet'
              }}
            </p>
          }
          <ul class="order-items">
            @for (item of order.orderItems; track item.id) {
              <li class="work-item">
                <div class="work-item-heading">
                  <strong>{{ item.product.name }}</strong
                  ><span class="status-pill" [attr.data-status]="item.status">{{
                    labels[item.status]
                  }}</span>
                </div>
                @if (order.status === 'OPEN') {
                  <div class="workflow-actions">
                    @for (target of targets(item); track target.status) {
                      <button
                        type="button"
                        class="secondary"
                        [disabled]="busy()"
                        (click)="setStatus(order, item, target.status)"
                      >
                        {{ target.label }}
                      </button>
                    }
                    @if (canManage(order)) {
                      <button
                        type="button"
                        class="quiet-button"
                        [disabled]="busy()"
                        (click)="requestRemoveItem(order, item)"
                      >
                        Position stornieren
                      </button>
                    }
                  </div>
                }
              </li>
            }
          </ul>
          @if (canManage(order)) {
            <div class="order-tools">
              <label [for]="'assign-' + order.id">Mitarbeiterzuordnung</label
              ><p-select
                [inputId]="'assign-' + order.id"
                [ariaLabel]="'Mitarbeiter für Bestellung ' + order.id"
                [options]="employeeOptions()"
                optionLabel="label"
                optionValue="id"
                [ngModel]="order.employeeId"
                (ngModelChange)="assign(order, $event)"
                [showClear]="true"
                placeholder="Nicht zugeordnet"
                [disabled]="busy()"
                appendTo="body"
              />
              <div class="form-row">
                <p-select
                  [ariaLabel]="'Produkt zu Bestellung ' + order.id + ' hinzufügen'"
                  [options]="catalog.products()"
                  optionLabel="name"
                  optionValue="id"
                  [(ngModel)]="additions[order.id]"
                  placeholder="Weitere Position"
                  [filter]="true"
                  appendTo="body"
                /><button
                  type="button"
                  class="secondary"
                  [disabled]="!additions[order.id] || busy()"
                  (click)="addItem(order)"
                >
                  Hinzufügen
                </button>
              </div>
              <div class="button-row">
                <button
                  type="button"
                  [disabled]="busy() || !allServed(order)"
                  (click)="requestCloseOrder(order)"
                >
                  Als bezahlt abschließen</button
                ><button
                  type="button"
                  class="secondary"
                  [disabled]="busy()"
                  (click)="requestRemoveOrder(order)"
                >
                  Bestellung stornieren
                </button>
              </div>
            </div>
          }
        </article>
      } @empty {
        <section class="form-panel">
          <h3 class="panel-title">Alles im Blick</h3>
          <p>
            {{
              live.connection() === 'loading'
                ? 'Bestellungen werden geladen …'
                : 'Aktuell keine passenden Bestellungen.'
            }}
          </p>
        </section>
      }
    </div>
  </section>`,
})
export class LiveBoard {
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  readonly catalog = inject(ProductService);
  readonly tables = inject(TableService);
  private readonly http = inject(HttpClient);
  readonly search = signal('');
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
        : 'Live-Bestellungen',
  );
  readonly filtered = computed(() =>
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
      .sort((a, b) => a.id - b.id),
  );
  readonly tableOptions = computed(() =>
    this.tables
      .tablesList()
      .map((table) => ({ id: table.id, label: `Tisch ${table.tableNumber}` })),
  );
  readonly freeTables = computed(() =>
    this.tableOptions().filter(
      (table) => !this.live.sessions().some((session) => session.tableId === table.id),
    ),
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
  moves: Record<number, number> = {};
  additions: Record<number, number> = {};
  pending: { label: string; execute: () => Promise<void> } | null = null;
  readonly qrImage = signal('');
  readonly qrLink = signal('');
  readonly qrTableNumber = signal(0);
  constructor() {
    effect(() => {
      const role = this.auth.staff()?.role;
      untracked(() => {
        this.pending = null;
        if (role !== 'ADMIN' && role !== 'SERVICE') {
          this.employees.set([]);
          this.qrImage.set('');
          this.qrLink.set('');
          return;
        }
        this.catalog.load();
        this.tables.getTables();
        void firstValueFrom(this.http.get<Employee[]>('/api/employees'))
          .then((employees) => this.employees.set(employees))
          .catch((error) =>
            this.error.set(apiError(error, 'Mitarbeiter konnten nicht geladen werden.')),
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
  sessionOrders(id: number): Order[] {
    return this.live.orders().filter((order) => order.tableSessionId === id);
  }
  canClear(session: TableSession): boolean {
    return this.sessionOrders(session.id).every((order) => order.status === 'CLOSED');
  }
  async perform(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      this.live.reload();
    } catch (error) {
      this.error.set(apiError(error, 'Die Änderung konnte nicht übernommen werden.'));
      this.live.reload();
    } finally {
      this.busy.set(false);
    }
  }
  queue(label: string, execute: () => Promise<void>): void {
    this.pending = { label, execute };
  }
  async confirm(): Promise<void> {
    const action = this.pending;
    this.pending = null;
    await action?.execute();
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
  async move(session: TableSession): Promise<void> {
    const tableId = this.moves[session.id];
    if (!tableId) return;
    await this.perform(() =>
      firstValueFrom(this.http.patch(`/api/table-sessions/${session.id}`, { tableId })),
    );
  }
  async closeSession(session: TableSession): Promise<void> {
    await this.perform(() =>
      firstValueFrom(this.http.post(`/api/table-sessions/${session.id}/close`, {})),
    );
  }
  requestCloseSession(session: TableSession): void {
    this.queue(`Tisch ${session.table.tableNumber} freigeben und den Gastzugang beenden?`, () =>
      this.closeSession(session),
    );
  }
  async showQr(): Promise<void> {
    if (!this.newTableId) return;
    await this.perform(async () => {
      const qr = await firstValueFrom(
        this.http.get<TableQrCode>(`/api/tables/${this.newTableId}/qr-code`),
      );
      const url = new URL('/gastzugang', location.origin);
      url.searchParams.set('tableId', String(qr.tableId));
      url.searchParams.set('token', qr.token);
      const generator = (await import('qrcode')).default;
      this.qrImage.set(await generator.toDataURL(url.href, { width: 360, margin: 3 }));
      this.qrLink.set(url.href);
      this.qrTableNumber.set(qr.tableNumber);
    });
  }
}
