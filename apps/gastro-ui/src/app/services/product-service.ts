import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Product } from '@smart-restaurant/contracts';
import { finalize } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private loaded = false;
  load(force = false): void {
    if (this.loading() || (this.loaded && !force)) return;
    this.loading.set(true);
    this.error.set('');
    this.http
      .get<Product[]>('/api/products')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loaded = true;
        },
        error: () =>
          this.error.set('Die Speisekarte konnte nicht geladen werden. Bitte erneut versuchen.'),
      });
  }
}
