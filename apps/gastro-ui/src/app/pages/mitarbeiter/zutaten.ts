import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { Ingredient } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../services/api-error';
import { LiveService } from '../../services/live-service';
import { focusEditor } from '../../services/focus-editor';

@Component({
  selector: 'app-zutaten',
  imports: [FormsModule, SelectModule],
  template: `<section>
    <div class="panel-heading">
      <div>
        <span class="eyebrow">Administration</span>
        <h1 class="panel-title">Zutaten & Bestand</h1>
        <p>Bestände werden bei jeder Bestellung live aktualisiert.</p>
      </div>
      <button type="button" (click)="edit()">Zutat anlegen</button>
    </div>
    @if (error()) {
      <p class="error-message" role="alert">{{ error() }}</p>
    }
    @if (success()) {
      <p class="success-message" role="status">{{ success() }}</p>
    }
    @if (live.error()) {
      <p class="error-message" role="alert">{{ live.error() }}</p>
      <button type="button" (click)="live.reload()">Erneut verbinden</button>
    }
    <div class="editor-grid">
      <div>
        <label for="ingredient-search">Zutat suchen</label
        ><input id="ingredient-search" type="search" [(ngModel)]="search" />
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Zutat</th>
                <th>Bestand</th>
                <th>Einheit</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              @for (ingredient of filtered(); track ingredient.id) {
                <tr>
                  <td>{{ ingredient.name }}</td>
                  <td>
                    <span [class.error-message]="ingredient.stock === 0">{{
                      ingredient.stock
                    }}</span>
                  </td>
                  <td>{{ ingredient.unit }}</td>
                  <td>
                    <button type="button" class="secondary" (click)="edit(ingredient)">
                      Bearbeiten</button
                    ><button
                      type="button"
                      class="secondary"
                      [disabled]="busy()"
                      (click)="removeCandidate.set(ingredient)"
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <form id="ingredient-editor" class="form-panel" #form="ngForm" (ngSubmit)="save()">
        <h2>{{ selected ? 'Zutat bearbeiten' : 'Neue Zutat' }}</h2>
        <label for="ingredient-name">Name</label
        ><input id="ingredient-name" name="name" [(ngModel)]="name" required maxlength="100" />
        <label for="ingredient-unit">Einheit</label
        ><p-select
          inputId="ingredient-unit"
          ariaLabel="Einheit"
          name="unit"
          [options]="units"
          [(ngModel)]="unit"
          appendTo="body"
        />
        <label for="ingredient-stock">Vorhandene Menge</label
        ><input
          id="ingredient-stock"
          name="stock"
          type="number"
          [(ngModel)]="stock"
          min="0"
          max="2147483647"
          step="1"
          required
        />
        @if (selected) {
          <p class="muted">
            Live-Bestand: {{ currentStock() }} {{ selected.unit }}. Ein geänderter Bestand muss vor
            dem Speichern neu übernommen werden.
          </p>
          <button type="button" class="secondary" (click)="useCurrentStock()">
            Live-Bestand übernehmen
          </button>
        }
        <p class="muted">
          Keine negativen Mengen. Die Einheit ist bei vorhandenem Bestand oder nach einer Buchung
          geschützt.
        </p>
        <div class="form-actions">
          <button type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Wird gespeichert …' : 'Speichern' }}</button
          ><button type="button" class="secondary" (click)="edit()">Zurücksetzen</button>
        </div>
      </form>
    </div>
    @if (removeCandidate(); as ingredient) {
      <div class="confirmation-panel" role="alertdialog" aria-label="Zutat entfernen">
        <p>„{{ ingredient.name }}“ entfernen? Verwendete Zutaten bleiben geschützt.</p>
        <button type="button" [disabled]="busy()" (click)="remove(ingredient)">
          Entfernen bestätigen</button
        ><button type="button" class="secondary" (click)="removeCandidate.set(null)">
          Abbrechen
        </button>
      </div>
    }
  </section>`,
})
export class Zutaten {
  private readonly http = inject(HttpClient);
  readonly live = inject(LiveService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
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
  edit(ingredient?: Ingredient, focus = true): void {
    this.selected = ingredient ?? null;
    this.name = ingredient?.name ?? '';
    this.unit = ingredient?.unit ?? 'g';
    this.stock = ingredient?.stock ?? 0;
    this.error.set('');
    this.success.set('');
    if (focus) focusEditor('ingredient-editor');
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.success.set('');
    if (!Number.isInteger(this.stock) || this.stock < 0) {
      this.error.set('Bitte eine ganze, nicht negative Menge eingeben.');
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
      this.success.set('Zutat gespeichert.');
      this.live.reload();
    } catch (error) {
      this.error.set(apiError(error));
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
      this.success.set('Zutat entfernt.');
      this.live.reload();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
