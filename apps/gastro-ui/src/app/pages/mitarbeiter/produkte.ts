import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { Product, ProductType } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../services/api-error';
import { ProductService } from '../../services/product-service';
import { LiveService } from '../../services/live-service';
import { focusEditor } from '../../services/focus-editor';

@Component({
  selector: 'app-produkte',
  imports: [CurrencyPipe, FormsModule, SelectModule],
  template: `<section>
    <div class="panel-heading">
      <div>
        <span class="eyebrow">Administration</span>
        <h1 class="panel-title">Produkte & Rezepte</h1>
        <p>Speisekarte, Preise und Zutaten pro Portion.</p>
      </div>
      <button type="button" (click)="edit()">Produkt anlegen</button>
    </div>
    @if (error()) {
      <p class="error-message" role="alert">{{ error() }}</p>
    }
    @if (success()) {
      <p class="success-message" role="status">{{ success() }}</p>
    }
    <div class="editor-grid">
      <div>
        <label for="product-search">Produkt suchen</label
        ><input id="product-search" type="search" [(ngModel)]="search" />
        @if (catalog.loading()) {
          <p role="status">Speisekarte wird geladen …</p>
        }
        @if (catalog.error()) {
          <p class="error-message">{{ catalog.error() }}</p>
          <button type="button" (click)="catalog.load(true)">Erneut laden</button>
        }
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Kategorie</th>
                <th>Preis</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              @for (product of filtered(); track product.id) {
                <tr>
                  <td>{{ product.name }}</td>
                  <td>{{ typeLabel(product.type) }}</td>
                  <td>{{ product.price | currency: 'EUR' }}</td>
                  <td>
                    <button type="button" class="secondary" (click)="edit(product)">
                      Bearbeiten</button
                    ><button
                      type="button"
                      class="secondary"
                      [disabled]="busy()"
                      (click)="removeCandidate.set(product)"
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
      <form id="product-editor" class="form-panel" #form="ngForm" (ngSubmit)="save()">
        <h2>{{ selected ? 'Produkt bearbeiten' : 'Neues Produkt' }}</h2>
        <label for="product-name">Name</label
        ><input id="product-name" name="name" [(ngModel)]="name" required maxlength="100" />
        <label for="product-description">Beschreibung</label
        ><textarea
          id="product-description"
          name="description"
          [(ngModel)]="description"
          maxlength="100"
          rows="3"
        ></textarea>
        <label for="product-type">Kategorie</label
        ><p-select
          inputId="product-type"
          ariaLabel="Kategorie"
          name="type"
          [options]="types"
          optionLabel="label"
          optionValue="value"
          [(ngModel)]="type"
          appendTo="body"
        />
        <label for="product-price">Preis (€)</label
        ><input
          id="product-price"
          name="price"
          type="number"
          [(ngModel)]="price"
          required
          min="0"
          step="0.01"
        />
        <h3>Rezept pro Portion</h3>
        <p class="muted">
          Mengen in der Einheit der jeweiligen Zutat. Diese Mengen werden beim Bestellen gebucht.
        </p>
        @for (line of recipe; track $index; let index = $index) {
          <div class="recipe-row">
            <p-select
              [inputId]="'recipe-' + index"
              [name]="'ingredient-' + index"
              [options]="ingredientOptions()"
              optionLabel="label"
              optionValue="value"
              [(ngModel)]="line.ingredientId"
              placeholder="Zutat"
              appendTo="body"
              ariaLabel="Zutat"
              required
            />
            <input
              type="number"
              [name]="'amount-' + index"
              [(ngModel)]="line.amount"
              min="1"
              step="1"
              required
              aria-label="Menge pro Portion"
            /><button
              type="button"
              class="secondary"
              (click)="recipe.splice(index, 1)"
              aria-label="Zutat aus Rezept entfernen"
            >
              ×
            </button>
          </div>
        }
        <button
          type="button"
          class="secondary"
          (click)="recipe.push({ ingredientId: null, amount: 1 })"
        >
          Zutat hinzufügen
        </button>
        <div class="form-actions">
          <button type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Wird gespeichert …' : 'Speichern' }}</button
          ><button type="button" class="secondary" (click)="edit()">Zurücksetzen</button>
        </div>
      </form>
    </div>
    @if (removeCandidate(); as product) {
      <div class="confirmation-panel" role="alertdialog" aria-label="Produkt entfernen">
        <p>„{{ product.name }}“ entfernen? Bereits bestellte Produkte bleiben geschützt.</p>
        <button type="button" [disabled]="busy()" (click)="remove(product)">
          Entfernen bestätigen</button
        ><button type="button" class="secondary" (click)="removeCandidate.set(null)">
          Abbrechen
        </button>
      </div>
    }
  </section>`,
})
export class Produkte {
  private readonly http = inject(HttpClient);
  readonly catalog = inject(ProductService);
  readonly live = inject(LiveService);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly removeCandidate = signal<Product | null>(null);
  selected: Product | null = null;
  search = '';
  name = '';
  description = '';
  price = 0;
  type: ProductType = 'FOOD';
  recipe: { ingredientId: number | null; amount: number }[] = [];
  readonly types: { label: string; value: ProductType }[] = [
    { label: 'Vorspeise', value: 'APPETIZER' },
    { label: 'Hauptgang', value: 'FOOD' },
    { label: 'Getränk', value: 'DRINK' },
  ];
  constructor() {
    this.catalog.load(true);
  }
  filtered(): Product[] {
    const search = this.search.toLocaleLowerCase();
    return this.catalog
      .products()
      .filter((product) => product.name.toLocaleLowerCase().includes(search));
  }
  typeLabel(type: ProductType): string {
    return this.types.find((option) => option.value === type)?.label ?? type;
  }
  ingredientOptions() {
    return this.live.ingredients().map((ingredient) => ({
      value: ingredient.id,
      label: `${ingredient.name} (${ingredient.unit})`,
    }));
  }
  edit(product?: Product, focus = true): void {
    this.selected = product ?? null;
    this.name = product?.name ?? '';
    this.description = product?.description ?? '';
    this.type = product?.type ?? 'FOOD';
    this.price = Number(product?.price ?? 0);
    this.recipe =
      product?.ingredients.map((line) => ({
        ingredientId: line.ingredientId,
        amount: line.amount,
      })) ?? [];
    this.error.set('');
    this.success.set('');
    if (focus) focusEditor('product-editor');
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    this.success.set('');
    if (
      this.recipe.some(
        (line) => !line.ingredientId || !Number.isInteger(line.amount) || line.amount <= 0,
      ) ||
      new Set(this.recipe.map((line) => line.ingredientId)).size !== this.recipe.length
    ) {
      this.error.set(
        'Jede Zutat darf nur einmal vorkommen; Mengen müssen positive ganze Zahlen sein.',
      );
      return;
    }
    if (!Number.isFinite(this.price) || this.price < 0) {
      this.error.set('Bitte einen gültigen Preis eingeben.');
      return;
    }
    this.busy.set(true);
    try {
      const body = {
        name: this.name.trim(),
        description: this.description.trim() || null,
        type: this.type,
        price: Math.round(this.price * 100) / 100,
        ingredients: this.recipe,
      };
      await firstValueFrom(
        this.selected
          ? this.http.patch(`/api/products/${this.selected.id}`, body)
          : this.http.post('/api/products', body),
      );
      this.edit(undefined, false);
      this.success.set('Produkt und Rezept gespeichert.');
      this.catalog.load(true);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(product: Product): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.delete(`/api/products/${product.id}`));
      this.removeCandidate.set(null);
      this.edit(undefined, false);
      this.success.set('Produkt entfernt.');
      this.catalog.load(true);
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
