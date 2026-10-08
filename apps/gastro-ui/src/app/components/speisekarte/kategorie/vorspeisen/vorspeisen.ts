import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Product } from '@smart-restaurant/contracts';
import { DataViewModule } from 'primeng/dataview';
import { ImageModule } from 'primeng/image';
import { ButtonModule } from 'primeng/button';
import { CurrencyPipe } from '@angular/common';
import { ProductService } from '../../../../services/product-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-vorspeisen',
  imports: [DataViewModule, ImageModule, ButtonModule, CurrencyPipe],
  templateUrl: './vorspeisen.html',
  styleUrl: './vorspeisen.css',
})
export class Vorspeisen {
  signalVorspeisen = signal<Product[]>([]);

  private productService: ProductService = inject(ProductService);
  private destroyRef: DestroyRef = inject(DestroyRef);
  private messageService = inject(MessageService);

  constructor() {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          this.signalVorspeisen.set(products.filter((product) => product.type === 'APPETIZER'));
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Die Methode getProducts() in Kategorie/Vorspeisen.',
          });
        },
      });
  }

  save(product: Product): void {
    this.productService.productsInWarenkorb.update(products => [...products, product]);
  }
}
