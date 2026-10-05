import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './services/auth-service';
import { LiveService } from './services/live-service';
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
  protected readonly auth = inject(AuthService);
  protected readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly staffArea = computed(() => this.url().startsWith('/mitarbeiter'));
  constructor() {
    void this.auth.ensure().catch(() => undefined);
  }
}
