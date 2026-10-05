import { MessageService } from 'primeng/api';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Select } from 'primeng/select';
import { TableService } from '../../services/table-service';
import { AuthService } from '../../services/auth-service';
import { apiError } from '../../services/api-error';
@Component({
  selector: 'app-startseite',
  imports: [RouterLink, FormsModule, Select],
  templateUrl: './startseite.html',
  styleUrl: './startseite.css',
})
export class Startseite {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  protected readonly tables = inject(TableService);
  protected readonly auth = inject(AuthService);
  protected readonly tableOptions = computed(() =>
    this.tables.tablesList().map((table) => ({
      id: table.id,
      label: `Tisch ${table.tableNumber}`,
    })),
  );
  private readonly router = inject(Router);
  readonly selectedId = signal<number | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() {
    this.tables.getTables();
    effect(() => this.selectedId.set(this.tables.selectedTable()?.id ?? null));
  }
  async continue(destination = '/speisekarte'): Promise<void> {
    const id = this.selectedId();
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.ensure();
      if (this.auth.staff()) this.tables.select(id);
      else if (this.auth.guest()?.tableId !== id) await this.auth.selectTable(id);
      await this.router.navigateByUrl(
        this.auth.staff() && destination === '/bestellungen'
          ? '/mitarbeiter/bestellungen'
          : destination,
      );
    } catch (error) {
      this.showError(
        apiError(error, 'Der Tisch konnte nicht ausgewählt werden. Bitte erneut versuchen.'),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
