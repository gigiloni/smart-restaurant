import { Component, DestroyRef, inject, signal } from '@angular/core';
import { DataViewModule } from 'primeng/dataview';
import { Product } from '@smart-restaurant/contracts';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../../../services/product-service';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { CurrencyPipe } from '@angular/common';
import { Image } from 'primeng/image';

@Component({
  selector: 'app-getraenke',
  imports: [DataViewModule, Button, CurrencyPipe, Image],
  templateUrl: './getraenke.html',
  styleUrl: './getraenke.css',
})
export class Getraenke {
  signalGetraenke = signal<Product[]>([]);

  private productService: ProductService = inject(ProductService);
  private destroyRef: DestroyRef = inject(DestroyRef);
  private messageService = inject(MessageService);

  constructor() {
    this.productService
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products: Product[]) => {
          this.signalGetraenke.set(products.filter((product) => product.type === 'DRINK'));
        },
        error: (error) => {
          this.messageService.add({
            severity: 'error',
            summary: 'Fehler',
            detail: 'Die Methode getProducts() in Kategorie/Getränke.',
          });
        },
      });
  }

  save(id: number): void {
    console.log(id);
  }
}
