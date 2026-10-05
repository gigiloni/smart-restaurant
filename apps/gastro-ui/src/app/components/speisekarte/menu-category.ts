import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ProductType } from '@smart-restaurant/contracts';
import { CartService } from '../../services/cart-service';
import { ProductService } from '../../services/product-service';
@Component({
  selector: 'app-menu-category',
  imports: [CurrencyPipe],
  template: `
    <div class="menu-grid">
      @for (product of products(); track product.id) {
        <article class="product-card">
          <div class="product-heading">
            <h4>{{ product.name }}</h4>
            <strong>{{ product.price | currency: 'EUR' }}</strong>
          </div>
          @if (product.description) {
            <p>{{ product.description }}</p>
          }
          @if (product.ingredients.length) {
            <p class="ingredients">
              Zutaten:
              @for (line of product.ingredients; track line.ingredientId; let last = $last) {
                {{ line.ingredient.name }}{{ last ? '' : ', ' }}
              }
            </p>
          }
          <button
            type="button"
            [disabled]="!cart.canAdd(product.id)"
            (click)="cart.add(product.id)"
            [attr.aria-label]="product.name + ' zum Warenkorb hinzufügen'"
          >
            Zum Warenkorb hinzufügen
          </button>
        </article>
      } @empty {
        <p>In dieser Kategorie gibt es derzeit keine Produkte.</p>
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
}
