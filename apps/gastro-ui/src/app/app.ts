import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CartService } from './services/cart-service';
import { TableService } from './services/table-service';
@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly cart = inject(CartService);
  protected readonly tables = inject(TableService);
}
