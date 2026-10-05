import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TabsModule } from 'primeng/tabs';
import { Vorspeisen } from '../../components/speisekarte/kategorie/vorspeisen/vorspeisen';
import { Hauptgaenge } from '../../components/speisekarte/kategorie/hauptgaenge/hauptgaenge';
import { Getraenke } from '../../components/speisekarte/kategorie/getraenke/getraenke';
import { OrderSummary } from '../../components/order-summary/order-summary';
import { ProductService } from '../../services/product-service';
import { CheckoutService } from '../../services/checkout-service';
@Component({
  selector: 'app-speisekarte',
  imports: [TabsModule, Vorspeisen, Hauptgaenge, Getraenke, OrderSummary, CurrencyPipe, RouterLink],
  templateUrl: './speisekarte.html',
  styleUrl: './speisekarte.css',
})
export class Speisekarte {
  protected readonly catalog = inject(ProductService);
  protected readonly state = inject(CheckoutService);
  constructor() {
    this.catalog.load();
    this.state.tables.getTables();
  }
}
