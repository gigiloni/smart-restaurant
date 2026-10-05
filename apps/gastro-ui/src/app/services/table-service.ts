import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Table } from '@smart-restaurant/contracts';
import { finalize } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class TableService {
  private readonly http = inject(HttpClient);
  readonly tablesList = signal<Table[]>([]);
  readonly selectedTable = signal<Table | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
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
          let id: number | undefined = this.selectedTable()?.id;
          try {
            id ??= Number(sessionStorage.getItem('sr.table.v1'));
          } catch {
            /* Memory state still works. */
          }
          this.selectedTable.set(tables.find((table) => table.id === id) ?? null);
        },
        error: () =>
          this.error.set('Die Tische konnten nicht geladen werden. Bitte erneut versuchen.'),
      });
  }
  select(id: number): void {
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
