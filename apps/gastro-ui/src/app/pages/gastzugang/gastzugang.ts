import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-gastzugang',
  imports: [RouterLink],
  template: `<main class="page">
    <section class="form-panel guest-entry">
      <span class="eyebrow">Ihr Tischbesuch</span>
      <h2>{{ busy() ? 'Wir bereiten Ihren Zugang vor …' : 'Willkommen am Tisch' }}</h2>
      @if (error()) {
        <p class="error-message" role="alert">{{ error() }}</p>
      }
      @if (hasCode && !busy()) {
        <button type="button" (click)="enter()">Erneut versuchen</button>
      }
      @if (!hasCode) {
        <p>
          Scannen Sie den QR-Code auf Ihrem Tisch mit der Kamera Ihres Smartphones. Danach können
          Sie bestellen und Ihre Bestellungen live verfolgen.
        </p>
        <p>
          Beim Neuladen bleibt Ihr Tischzugang erhalten. Er endet, wenn der Service den Tischbesuch
          abschließt.
        </p>
      }
      <a class="primary-button" routerLink="/speisekarte">Speisekarte ansehen</a>
    </section>
  </main>`,
  styles: [
    `
      .guest-entry {
        max-width: 620px;
        margin: 3rem auto;
      }
      h2 {
        line-height: 1.2;
      }
      p {
        font: 1rem/1.7 var(--font-ui);
      }
    `,
  ],
})
export class Gastzugang {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tableId = Number(this.route.snapshot.queryParamMap.get('tableId'));
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly hasCode = Number.isSafeInteger(this.tableId) && this.tableId > 0 && !!this.token;
  readonly busy = signal(false);
  readonly error = signal('');
  constructor() {
    if (this.hasCode) void this.enter();
  }
  async enter(): Promise<void> {
    if (this.busy() || !this.hasCode) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.ensure();
      if (this.auth.staff()) {
        this.error.set(
          'Sie sind als Mitarbeiter angemeldet. Für einen Gastzugang bitte zuerst abmelden.',
        );
        return;
      }
      await this.auth.enterGuest({ tableId: this.tableId, token: this.token });
      await this.router.navigateByUrl('/speisekarte', { replaceUrl: true });
    } catch {
      this.error.set(
        'Dieser Tischzugang konnte nicht geöffnet werden. Bitte QR-Code prüfen oder den Service ansprechen.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
