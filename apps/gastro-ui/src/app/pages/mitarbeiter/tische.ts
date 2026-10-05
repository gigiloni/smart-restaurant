import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { Select } from 'primeng/select';
import type { Table, TableSession } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth-service';
import { LiveService } from '../../services/live-service';
import { TableService } from '../../services/table-service';
import { apiError } from '../../services/api-error';

@Component({
  selector: 'app-tische',
  imports: [FormsModule, RouterLink, DialogModule, Select],
  templateUrl: './tische.html',
})
export class Tische {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  readonly tables = inject(TableService);
  private readonly http = inject(HttpClient);
  readonly search = signal('');
  readonly status = signal('all');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly statuses = [
    { label: 'Alle Tische', value: 'all' },
    { label: 'Belegt', value: 'occupied' },
    { label: 'Frei', value: 'free' },
  ];
  readonly filtered = computed(() =>
    this.tables
      .tablesList()
      .filter(
        (table) =>
          String(table.tableNumber).includes(this.search().trim()) &&
          (this.status() === 'all' ||
            !!this.sessionFor(table.id) === (this.status() === 'occupied')),
      )
      .sort((a, b) => a.tableNumber - b.tableNumber),
  );
  readonly freeTables = computed(() =>
    this.tables
      .tablesList()
      .filter((table) => !this.sessionFor(table.id))
      .map((table) => ({ id: table.id, label: `Tisch ${table.tableNumber}` })),
  );
  editorOpen = false;
  selected: Table | null = null;
  tableNumber = 1;
  seats = 2;
  moveCandidate: TableSession | null = null;
  targetId: number | null = null;
  pending: { label: string; execute: () => Promise<unknown> } | null = null;
  constructor() {
    this.tables.getTables();
  }
  sessionFor(tableId: number): TableSession | undefined {
    return this.live.sessions().find((session) => session.tableId === tableId);
  }
  sessionOrders(id: number) {
    return this.live.orders().filter((order) => order.tableSessionId === id);
  }
  canClear(session: TableSession): boolean {
    return this.sessionOrders(session.id).every((order) => order.status === 'CLOSED');
  }
  edit(table?: Table): void {
    this.selected = table ?? null;
    this.tableNumber =
      table?.tableNumber ??
      Math.max(0, ...this.tables.tablesList().map((entry) => entry.tableNumber)) + 1;
    this.seats = table?.seats ?? 2;
    this.error.set('');
    this.editorOpen = true;
  }
  requestMove(session: TableSession): void {
    this.moveCandidate = session;
    this.targetId = null;
    this.error.set('');
  }
  requestClear(session: TableSession): void {
    this.error.set('');
    this.pending = {
      label: `Tisch ${session.table.tableNumber} freigeben und den Gastzugang beenden?`,
      execute: () => firstValueFrom(this.http.post(`/api/table-sessions/${session.id}/close`, {})),
    };
  }
  requestRemove(table: Table): void {
    this.error.set('');
    this.pending = {
      label: `Tisch ${table.tableNumber} entfernen? Tische mit bestehenden Besuchen oder Bestellungen bleiben geschützt.`,
      execute: () => firstValueFrom(this.http.delete(`/api/tables/${table.id}`)),
    };
  }
  private async perform(action: () => Promise<unknown>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
      this.editorOpen = false;
      this.moveCandidate = null;
      this.pending = null;
      this.tables.getTables();
      this.live.reload();
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Änderung gespeichert.',
      });
    } catch (error) {
      this.showError(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async save(): Promise<void> {
    if (
      !Number.isInteger(this.tableNumber) ||
      this.tableNumber < 1 ||
      !Number.isInteger(this.seats) ||
      this.seats < 0
    )
      return;
    await this.perform(() =>
      firstValueFrom(
        this.selected
          ? this.http.patch(`/api/tables/${this.selected.id}`, {
              tableNumber: this.tableNumber,
              seats: this.seats,
            })
          : this.http.post('/api/tables', { tableNumber: this.tableNumber, seats: this.seats }),
      ),
    );
  }
  async move(): Promise<void> {
    if (!this.moveCandidate || !this.targetId) return;
    const id = this.moveCandidate.id,
      tableId = this.targetId;
    await this.perform(() =>
      firstValueFrom(this.http.patch(`/api/table-sessions/${id}`, { tableId })),
    );
  }
  async confirm(): Promise<void> {
    if (this.pending) await this.perform(this.pending.execute);
  }
}
