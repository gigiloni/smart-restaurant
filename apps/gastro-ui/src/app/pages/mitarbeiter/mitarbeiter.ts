import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { LiveService } from '../../services/live-service';

@Component({
  selector: 'app-mitarbeiter',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `<div class="staff-layout">
    <aside class="staff-sidebar">
      <span class="eyebrow">Bellavista · Team</span>
      <h2>{{ auth.employee()?.firstname }}</h2>
      <p>{{ roles[auth.staff()?.role ?? 'SERVICE'] }}</p>
      <nav aria-label="Mitarbeiternavigation">
        <a
          routerLink="/mitarbeiter"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Live-Bestellungen</a
        >
        @if (auth.hasRole('ADMIN')) {
          <a routerLink="personal" routerLinkActive="active">Mitarbeiter</a
          ><a routerLink="produkte" routerLinkActive="active">Produkte & Rezepte</a
          ><a routerLink="zutaten" routerLinkActive="active">Zutaten & Bestand</a>
        }
        <a routerLink="konto" routerLinkActive="active">Mein Konto</a>
      </nav>
      <div class="live-indicator" role="status">
        <span [class.online]="live.connection() === 'connected'"></span
        >{{ live.connection() === 'connected' ? 'Live verbunden' : 'Verbindung wird hergestellt' }}
      </div>
      <button type="button" class="secondary" (click)="logout()">Abmelden</button>
      @if (error) {
        <p class="error-message" role="alert">{{ error }}</p>
      }
    </aside>
    <div class="staff-content"><router-outlet /></div>
  </div>`,
})
export class Mitarbeiter {
  readonly auth = inject(AuthService);
  readonly live = inject(LiveService);
  private readonly router = inject(Router);
  readonly roles = { ADMIN: 'Administration', SERVICE: 'Service', KITCHEN: 'Küche', BAR: 'Bar' };
  error = '';
  constructor() {
    effect(() => {
      if (this.auth.initialized() && !this.auth.staff())
        void this.router.navigate(['/anmelden'], { queryParams: { returnUrl: this.router.url } });
      else if (
        this.auth.staff() &&
        !this.auth.hasRole('ADMIN') &&
        /^\/mitarbeiter\/(personal|produkte|zutaten)/.test(this.router.url)
      )
        void this.router.navigateByUrl('/mitarbeiter');
    });
  }
  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/anmelden');
    } catch {
      this.error = 'Abmeldung fehlgeschlagen. Bitte erneut versuchen.';
    }
  }
}
