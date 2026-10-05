import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderSummary } from '../../components/order-summary/order-summary';
import { CheckoutService } from '../../services/checkout-service';
import { imageForProduct } from '../../services/product-images';
@Component({
  selector: 'app-warenkorb',
  imports: [CurrencyPipe, RouterLink, OrderSummary],
  templateUrl: './warenkorb.html',
  styleUrl: './warenkorb.css',
})
export class Warenkorb {
  protected readonly state = inject(CheckoutService);
  protected readonly imageFor = imageForProduct;
  constructor() {
    this.state.catalog.load(true);
    this.state.tables.getTables();
  }
  protected imageFallback(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (!image.src.endsWith('/dishes/placeholder.svg')) image.src = '/dishes/placeholder.svg';
  }
}
