import { MessageService } from 'primeng/api';
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Table } from '@smart-restaurant/contracts';
import { finalize } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  private readonly http = inject(HttpClient);
  readonly tablesList = signal<Table[]>([]);
  readonly selectedTable = signal<Table | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly guestTableId = signal<number | null>(null);
  bindGuest(id: number | null): void {
    if (this.guestTableId() === id) return;
    this.guestTableId.set(id);
    if (id === null) this.select(0);
    else {
      this.select(id);
      if (!this.tablesList().length) this.getTables();
    }
  }
  getTables(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<Table[]>('/api/tables')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (tables) => {
          this.tablesList.set(tables);
          let id: number | undefined = this.guestTableId() ?? this.selectedTable()?.id;
          try {
            id ??= Number(sessionStorage.getItem('sr.table.v1'));
          } catch {
            /* Memory state still works. */
          }
          this.selectedTable.set(tables.find((table) => table.id === id) ?? null);
        },
        error: () =>
          this.showError('Die Tische konnten nicht geladen werden. Bitte erneut versuchen.'),
      });
  }
  select(id: number): void {
    if (this.guestTableId() !== null && id !== this.guestTableId()) return;
    const table = this.tablesList().find((entry) => entry.id === id) ?? null;
    this.selectedTable.set(table);
    try {
      if (table) sessionStorage.setItem('sr.table.v1', String(table.id));
      else sessionStorage.removeItem('sr.table.v1');
    } catch {
      /* Selection remains available until reload. */
    }
  }
}
