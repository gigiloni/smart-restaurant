import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DataViewModule } from 'primeng/dataview';
import { Product } from '@smart-restaurant/contracts';
import { ProductService } from '../../../../services/product-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { CurrencyPipe } from '@angular/common';
import { Image } from 'primeng/image';

@Component({
  selector: 'app-hauptgaenge',
  imports: [DataViewModule, Button, CurrencyPipe, Image],
  templateUrl: './hauptgaenge.html',
  styleUrl: './hauptgaenge.css',
})
export class Hauptgaenge {
  signalHauptgaenge = signal<Product[]>([]);

  private productService: ProductService = inject(ProductService);
  private destroyRef: DestroyRef = inject(DestroyRef);
  private messageService = inject(MessageService);

  constructor() {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          this.signalHauptgaenge.set(products.filter((product) => product.type === 'FOOD'));
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Die Methode getProducts() in Kategorie/Hauptgänge.',
          });
        },
      });
  }

  save(id: number): void {
    console.log(id);
  }
}
