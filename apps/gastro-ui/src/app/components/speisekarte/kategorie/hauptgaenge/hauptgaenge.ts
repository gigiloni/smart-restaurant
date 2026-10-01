import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DataViewModule } from 'primeng/dataview';
import { Product } from '@smart-restaurant/contracts';
import { ProductService } from '../../../../services/product-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-hauptgaenge',
  imports: [DataViewModule],
  templateUrl: './hauptgaenge.html',
  styleUrl: './hauptgaenge.css',
})
export class Hauptgaenge {
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
