import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Badge } from 'primeng/badge';
import { CartService } from './services/cart-service';
import { TableService } from './services/table-service';
@Component({
  imports: [RouterModule, Badge],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly cart = inject(CartService);
  protected readonly tables = inject(TableService);
}
