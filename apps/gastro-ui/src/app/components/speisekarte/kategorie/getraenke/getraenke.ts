import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DataViewModule } from 'primeng/dataview';
import { Product } from '@smart-restaurant/contracts';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../../../services/product-service';

@Component({
  selector: 'app-getraenke',
  imports: [DataViewModule],
  templateUrl: './getraenke.html',
  styleUrl: './getraenke.css',
})
export class Getraenke {
  productsInSpeisekarte = signal<Product[]>([]);
  private productService: ProductService = inject(ProductService);
  private destroyRef: DestroyRef = inject(DestroyRef);

  constructor() {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          this.productsInSpeisekarte.set(products);
        },
      });
  }
}
