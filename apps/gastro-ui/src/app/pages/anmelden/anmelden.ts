import { PasswordToggle } from '../../components/password-toggle/password-toggle';
import { MessageService } from 'primeng/api';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-anmelden',
  imports: [PasswordToggle, FormsModule, RouterLink],
  templateUrl: './anmelden.html',
  styleUrl: './anmelden.css',
})
export class Anmelden {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
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
      this.showError('Anmeldung fehlgeschlagen. Bitte Zugangsdaten und Verbindung prüfen.');
    } finally {
      this.busy.set(false);
    }
  }
}
