import { HttpClient } from "@angular/common/http";
import {inject, Injectable, signal} from "@angular/core";
import {Product} from "@smart-restaurant/contracts"
import {MessageService} from "primeng/api";

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  protected http = inject(HttpClient);
  protected messageService = inject(MessageService);

  protected productsInWarenkorb = signal<Product[]>([]);

  getProductsById(productIdList: number[]) {
    this.http.post<Product[]>('/products/getProductsById', productIdList).subscribe({
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
