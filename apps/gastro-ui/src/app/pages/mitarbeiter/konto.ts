import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth-service';

@Component({
  selector: 'app-konto',
  imports: [FormsModule],
  template: `<section>
    <div class="page-heading">
      <div>
        <span class="eyebrow">Ihr Mitarbeiterkonto</span>
        <h2>Mein Konto</h2>
        <p>{{ auth.employee()?.firstname }} {{ auth.employee()?.lastname }}</p>
      </div>
    </div>
    <form class="form-panel" (ngSubmit)="change()" #form="ngForm">
      <h3 class="panel-title">Passwort ändern</h3>
      <label for="current-password">Bisheriges Passwort</label
      ><input
        id="current-password"
        name="current"
        type="password"
        autocomplete="current-password"
        [(ngModel)]="current"
        required
        maxlength="128"
      />
      <label for="new-password">Neues Passwort (mindestens 12 Zeichen)</label
      ><input
        id="new-password"
        name="next"
        type="password"
        autocomplete="new-password"
        [(ngModel)]="next"
        required
        minlength="12"
        maxlength="128"
      />
      <label for="confirm-password">Neues Passwort wiederholen</label
      ><input
        id="confirm-password"
        name="confirm"
        type="password"
        autocomplete="new-password"
        [(ngModel)]="confirm"
        required
      />
      @if (message()) {
        <p role="status">{{ message() }}</p>
      }
      @if (error()) {
        <p class="error-message" role="alert">{{ error() }}</p>
      }
      <button type="submit" [disabled]="form.invalid || next !== confirm || busy()">
        Passwort speichern
      </button>
    </form>
  </section>`,
})
export class Konto {
  readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  current = '';
  next = '';
  confirm = '';
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  async change(): Promise<void> {
    if (this.busy() || this.next !== this.confirm) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
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
      this.message.set('Ihr Passwort wurde geändert. Andere Anmeldungen wurden beendet.');
    } catch {
      this.error.set(
        'Das Passwort konnte nicht geändert werden. Bitte bisheriges Passwort prüfen.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
