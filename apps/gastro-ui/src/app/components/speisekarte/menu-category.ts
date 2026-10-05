import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ProductType } from '@smart-restaurant/contracts';
import { CartService } from '../../services/cart-service';
import { ProductService } from '../../services/product-service';
import { imageForProduct } from '../../services/product-images';
@Component({
  selector: 'app-menu-category',
  imports: [CurrencyPipe],
  templateUrl: './menu-category.html',
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
