import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { LiveService } from '../../services/live-service';
import { statusLabels, orderTotal } from '../../services/order-presentation';

@Component({
  selector: 'app-bestellungen',
  imports: [CurrencyPipe, RouterLink],
  template: `<main class="page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Ihr Tischbesuch</span>
        <h2>Meine Bestellungen</h2>
        <p>
          {{
            live.visitEnded()
              ? 'Ihr Tischbesuch ist beendet.'
              : 'Ihre Bestellungen bleiben auch nach dem Neuladen sichtbar.'
          }}
        </p>
      </div>
      <a class="primary-button" routerLink="/speisekarte">Weitere Speisen auswählen →</a>
    </div>
    @if (live.visitEnded()) {
      <section class="form-panel">
        <h3 class="panel-title">Vielen Dank für Ihren Besuch</h3>
        <p>Für einen neuen Tischbesuch scannen Sie bitte den QR-Code erneut.</p>
        <a routerLink="/gastzugang">Zum Tischzugang</a>
      </section>
    } @else {
      <div class="live-indicator" role="status">
        <span [class.online]="live.connection() === 'connected'"></span
        >{{
          live.connection() === 'connected'
            ? 'Live verbunden'
            : 'Live-Verbindung wird hergestellt …'
        }}
      </div>
      @if (live.error()) {
        <p class="error-message" role="status">{{ live.error() }}</p>
        <button type="button" class="secondary" (click)="live.reload()">Erneut laden</button>
      }
      @if (session(); as session) {
        <p class="table-label">Tisch {{ session.table.tableNumber }}</p>
      }
      <div class="order-grid">
        @for (order of orders(); track order.id) {
          <article class="order-panel">
            <header>
              <div>
                <span class="eyebrow">Bestellung #{{ order.id }}</span>
                <h3 class="panel-title">
                  {{ order.status === 'CLOSED' ? 'Bezahlt' : 'Für Sie in Arbeit' }}
                </h3>
              </div>
              <strong>{{ total(order) / 100 | currency: 'EUR' }}</strong>
            </header>
            <ul class="order-items">
              @for (item of order.orderItems; track item.id) {
                <li>
                  <span>{{ item.product.name }}</span
                  ><span class="status-pill" [attr.data-status]="item.status">{{
                    labels[item.status]
                  }}</span>
                </li>
              }
            </ul>
          </article>
        } @empty {
          @if (live.connection() !== 'loading') {
            <section class="form-panel">
              <h3 class="panel-title">Noch keine Bestellung</h3>
              <p>Nach dem Absenden erscheint Ihre Bestellung hier automatisch.</p>
              <a routerLink="/speisekarte">Speisekarte öffnen</a>
            </section>
          }
        }
      </div>
    }
  </main>`,
})
export class Bestellungen {
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  readonly labels = statusLabels;
  readonly total = orderTotal;
  readonly orders = computed(() => [...this.live.orders()].sort((a, b) => b.id - a.id));
  readonly session = computed(() =>
    this.live.sessions().find((session) => session.id === this.auth.guest()?.tableSessionId),
  );
}
