import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { Ingredient } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../services/api-error';
import { LiveService } from '../../services/live-service';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-zutaten',
  imports: [FormsModule, SelectModule, DialogModule],
  templateUrl: './zutaten.html',
})
export class Zutaten {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  private readonly http = inject(HttpClient);
  readonly live = inject(LiveService);
  readonly busy = signal(false);
  editorOpen = false;
  readonly error = signal('');
  readonly removeCandidate = signal<Ingredient | null>(null);
  selected: Ingredient | null = null;
  name = '';
  unit: Ingredient['unit'] = 'g';
  stock = 0;
  search = '';
  readonly units = ['g', 'ml', 'Stück'];
  filtered(): Ingredient[] {
    const search = this.search.toLocaleLowerCase();
    return [...this.live.ingredients()]
      .filter((ingredient) => (ingredient.name ?? '').toLocaleLowerCase().includes(search))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }
  currentStock(): number {
    return (
      this.live.ingredients().find((ingredient) => ingredient.id === this.selected?.id)?.stock ??
      this.selected?.stock ??
      0
    );
  }
  useCurrentStock(): void {
    const current = this.live
      .ingredients()
      .find((ingredient) => ingredient.id === this.selected?.id);
    if (current && this.selected) {
      this.selected = { ...this.selected, stock: current.stock };
      this.stock = current.stock;
      this.error.set('');
    }
  }
  edit(ingredient?: Ingredient, open = true): void {
    this.selected = ingredient ?? null;
    this.name = ingredient?.name ?? '';
    this.unit = ingredient?.unit ?? 'g';
    this.stock = ingredient?.stock ?? 0;
    this.error.set('');
    this.editorOpen = open;
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (!Number.isInteger(this.stock) || this.stock < 0) {
      this.showError('Bitte eine ganze, nicht negative Menge eingeben.');
      return;
    }
    this.busy.set(true);
    try {
      const body = this.selected
        ? {
            name: this.name.trim(),
            unit: this.unit,
            ...(this.stock !== this.selected.stock
              ? { stock: this.stock, expectedStock: this.selected.stock }
              : {}),
          }
        : { name: this.name.trim(), unit: this.unit, stock: this.stock };
      await firstValueFrom(
        this.selected
          ? this.http.patch(`/api/ingredients/${this.selected.id}`, body)
          : this.http.post('/api/ingredients', body),
      );
      this.edit(undefined, false);
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Zutat gespeichert.',
      });
      this.live.reload();
    } catch (error) {
      this.showError(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(ingredient: Ingredient): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.delete(`/api/ingredients/${ingredient.id}`));
      this.removeCandidate.set(null);
      this.edit(undefined, false);
      this.messages.add({ severity: 'success', summary: 'Erfolgreich', detail: 'Zutat entfernt.' });
      this.live.reload();
    } catch (error) {
      this.showError(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
