import { HttpClient } from "@angular/common/http";
import {inject, Injectable, signal} from "@angular/core";
import {Product} from "@smart-restaurant/contracts"
import {MessageService} from "primeng/api";
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  protected http = inject(HttpClient);
  protected messageService = inject(MessageService);

  public productsInWarenkorb = signal<Product[]>([]);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>('/api/products')};

  getProductsById(productIdList: number[]) {
    this.http.post<Product[]>('/ProductsById', {ids: productIdList}).subscribe({
      next: products => {
        this.productsInWarenkorb.set(products);
      },
      error: error => {
        this.messageService.add({
          severity: "error",
          summary: "Fehler",
          detail: "Produkte im Warenkorb konnte nicht geladen werden."
        })
      }
    });
  }
}
