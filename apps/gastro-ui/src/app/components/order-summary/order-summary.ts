import { CurrencyPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from 'primeng/badge';
import { CheckoutService } from '../../services/checkout-service';

@Component({
  selector: 'app-order-summary',
  imports: [CurrencyPipe, RouterLink, Badge],
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
})
export class OrderSummary {
  readonly checkout = input(false);
  protected readonly state = inject(CheckoutService);
}
