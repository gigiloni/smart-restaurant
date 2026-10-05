import { Component, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth-service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-mitarbeiter',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './mitarbeiter.html',
})
export class Mitarbeiter {
  readonly auth = inject(AuthService);
  private readonly messages = inject(MessageService);
  private readonly router = inject(Router);
  readonly roles = { ADMIN: 'Administration', SERVICE: 'Service', KITCHEN: 'Küche', BAR: 'Bar' };
  constructor() {
    effect(() => {
      if (this.auth.initialized() && !this.auth.staff())
        void this.router.navigate(['/anmelden'], { queryParams: { returnUrl: this.router.url } });
      else if (
        this.auth.staff() &&
        !this.auth.hasRole('ADMIN') &&
        (/^\/mitarbeiter\/(personal|produkte|zutaten)/.test(this.router.url) ||
          (!this.auth.hasRole('SERVICE') && /^\/mitarbeiter\/tische/.test(this.router.url)))
      )
        void this.router.navigateByUrl('/mitarbeiter');
    });
  }
  async logout(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/anmelden');
    } catch {
      this.messages.add({
        severity: 'error',
        summary: 'Fehler',
        detail: 'Abmeldung fehlgeschlagen. Bitte erneut versuchen.',
      });
    }
  }
}
