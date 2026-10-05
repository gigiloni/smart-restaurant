import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select } from 'primeng/select';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { LiveService } from '../../services/live-service';
import { statusLabels, orderTotal } from '../../services/order-presentation';
import { sortOrders, orderSortOptions, type OrderSort } from '../../services/order-sort';

@Component({
  selector: 'app-bestellungen',
  imports: [CurrencyPipe, RouterLink, FormsModule, Select],
  templateUrl: './bestellungen.html',
})
export class Bestellungen {
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  readonly labels = statusLabels;
  readonly total = orderTotal;
  readonly sort = signal<OrderSort>('newest');
  readonly sortOptions = orderSortOptions.filter((option) => option.value !== 'table');
  readonly orders = computed(() =>
    sortOrders(this.auth.guest() ? this.live.orders() : [], this.sort()),
  );
  readonly session = computed(() =>
    this.live.sessions().find((session) => session.id === this.auth.guest()?.tableSessionId),
  );
}
