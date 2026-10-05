import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-konto',
  imports: [FormsModule],
  templateUrl: './konto.html',
})
export class Konto {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  current = '';
  next = '';
  confirm = '';
  readonly busy = signal(false);
  readonly error = signal('');
  async change(): Promise<void> {
    if (this.busy() || this.next !== this.confirm) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(
        this.http.post('/api/auth/change-password', {
          currentPassword: this.current,
          newPassword: this.next,
          revokeOtherSessions: true,
        }),
      );
      this.current = '';
      this.next = '';
      this.confirm = '';
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Ihr Passwort wurde geändert. Andere Anmeldungen wurden beendet.',
      });
    } catch {
      this.showError(
        'Das Passwort konnte nicht geändert werden. Bitte bisheriges Passwort prüfen.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
