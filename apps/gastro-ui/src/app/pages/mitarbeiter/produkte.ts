import { MessageService } from 'primeng/api';
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
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-produkte',
  imports: [CurrencyPipe, FormsModule, SelectModule, DialogModule],
  templateUrl: './produkte.html',
})
export class Produkte {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  private readonly http = inject(HttpClient);
  readonly catalog = inject(ProductService);
  readonly live = inject(LiveService);
  readonly busy = signal(false);
  editorOpen = false;
  readonly error = signal('');
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
  edit(product?: Product, open = true): void {
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
    this.editorOpen = open;
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.error.set('');
    if (
      this.recipe.some(
        (line) => !line.ingredientId || !Number.isInteger(line.amount) || line.amount <= 0,
      ) ||
      new Set(this.recipe.map((line) => line.ingredientId)).size !== this.recipe.length
    ) {
      this.showError(
        'Jede Zutat darf nur einmal vorkommen; Mengen müssen positive ganze Zahlen sein.',
      );
      return;
    }
    if (!Number.isFinite(this.price) || this.price < 0) {
      this.showError('Bitte einen gültigen Preis eingeben.');
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
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Produkt und Rezept gespeichert.',
      });
      this.catalog.load(true);
    } catch (error) {
      this.showError(apiError(error));
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
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Produkt entfernt.',
      });
      this.catalog.load(true);
    } catch (error) {
      this.showError(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
