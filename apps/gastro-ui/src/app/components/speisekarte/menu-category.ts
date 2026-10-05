import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ProductType } from '@smart-restaurant/contracts';
import { CartService } from '../../services/cart-service';
import { ProductService } from '../../services/product-service';
import { imageForProduct } from '../../services/product-images';
@Component({
  selector: 'app-menu-category',
  imports: [CurrencyPipe],
  template: `
    <div class="menu-grid">
      @for (product of products(); track product.id) {
        <article class="product-card">
          <div class="product-photo">
            <img
              [src]="imageFor(product.name)"
              [alt]="product.name + ' – Serviervorschlag'"
              width="640"
              height="400"
              loading="lazy"
              (error)="imageFallback($event)"
            />
            @if (cart.quantity(product.id)) {
              <span class="selected-pill">{{ cart.quantity(product.id) }} im Warenkorb</span>
            }
          </div>
          <div class="product-body">
            <div class="product-heading">
              <h4>{{ product.name }}</h4>
              <strong>{{ product.price | currency: 'EUR' }}</strong>
            </div>
            <p class="product-description">
              {{ product.description ?? 'Ein Klassiker aus unserer italienischen Küche.' }}
            </p>
            @if (product.ingredients.length) {
              <details class="ingredients">
                <summary>Zutaten ansehen</summary>
                <p>
                  @for (line of product.ingredients; track line.ingredientId; let last = $last) {
                    {{ line.ingredient.name }}{{ last ? '' : ', ' }}
                  }
                </p>
              </details>
            } @else {
              <span class="ingredient-spacer" aria-hidden="true"></span>
            }
            <button
              class="add-button"
              type="button"
              [disabled]="!cart.canAdd(product.id)"
              (click)="cart.add(product.id)"
              [attr.aria-label]="product.name + ' zum Warenkorb hinzufügen'"
            >
              <span aria-hidden="true">＋</span> Hinzufügen
            </button>
          </div>
        </article>
      } @empty {
        <p class="category-empty">In dieser Kategorie gibt es derzeit keine Produkte.</p>
      }
    </div>
  `,
})
export class MenuCategory {
  readonly type = input.required<ProductType>();
  protected readonly catalog = inject(ProductService);
  protected readonly cart = inject(CartService);
  protected readonly products = computed(() =>
    this.catalog.products().filter((product) => product.type === this.type()),
  );
  protected readonly imageFor = imageForProduct;
  protected imageFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    if (!image.src.endsWith('/dishes/placeholder.svg')) image.src = '/dishes/placeholder.svg';
  }
}
