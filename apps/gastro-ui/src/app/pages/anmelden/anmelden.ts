import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-anmelden',
  imports: [FormsModule, RouterLink],
  template: `<main class="page auth-page">
    <section class="form-panel">
      <span class="eyebrow">Bellavista · Mitarbeiter</span>
      <h2>Willkommen zurück</h2>
      <p>Melden Sie sich mit Ihrem Mitarbeiterkonto an.</p>
      <form (ngSubmit)="submit()" #form="ngForm">
        <label for="email">E-Mail</label
        ><input
          id="email"
          name="email"
          type="email"
          autocomplete="username"
          [(ngModel)]="email"
          required
          email
          maxlength="254"
        />
        <label for="password">Passwort</label
        ><input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password"
          [(ngModel)]="password"
          required
          maxlength="128"
        />
        <label class="checkbox-label"
          ><input name="remember" type="checkbox" [(ngModel)]="remember" /> Angemeldet
          bleiben</label
        >
        @if (error()) {
          <p class="error-message" role="alert">{{ error() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Anmeldung läuft …' : 'Anmelden' }}
        </button>
      </form>
      <a routerLink="/speisekarte">Zur Speisekarte</a>
    </section>
  </main>`,
  styles: [
    `
      .auth-page {
        display: grid;
        place-items: center;
        min-height: 75svh;
      }
      .form-panel {
        width: min(100%, 480px);
      }
      h2 {
        line-height: 1.2;
      }
    `,
  ],
})
export class Anmelden {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  email = '';
  password = '';
  remember = false;
  readonly busy = signal(false);
  readonly error = signal('');
  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signIn(this.email, this.password, this.remember);
      this.password = '';
      const destination = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(
        destination?.startsWith('/mitarbeiter') ? destination : '/mitarbeiter',
      );
    } catch {
      this.error.set('Anmeldung fehlgeschlagen. Bitte Zugangsdaten und Verbindung prüfen.');
    } finally {
      this.busy.set(false);
    }
  }
}
