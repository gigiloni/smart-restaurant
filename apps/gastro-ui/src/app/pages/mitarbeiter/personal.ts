import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { Employee, EmployeeRole } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../services/api-error';
import { AuthService } from '../../services/auth-service';
import { focusEditor } from '../../services/focus-editor';

@Component({
  selector: 'app-personal',
  imports: [FormsModule, SelectModule],
  template: `<section>
    <div class="panel-heading">
      <div>
        <span class="eyebrow">Administration</span>
        <h1 class="panel-title">Mitarbeiter</h1>
        <p>Konten und Berechtigungen für das Restaurantteam.</p>
      </div>
      <button type="button" (click)="edit()">Mitarbeiter anlegen</button>
    </div>
    @if (error()) {
      <p class="error-message" role="alert">{{ error() }}</p>
    }
    @if (success()) {
      <p class="success-message" role="status">{{ success() }}</p>
    }
    <div class="editor-grid">
      <div>
        <label for="staff-search">Mitarbeiter suchen</label
        ><input id="staff-search" type="search" [(ngModel)]="search" />
        @if (loading()) {
          <p role="status">Mitarbeiter werden geladen …</p>
        }
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rolle</th>
                <th>Zugang</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              @for (person of filtered(); track person.id) {
                <tr>
                  <td>{{ person.firstname }} {{ person.lastname }}</td>
                  <td>{{ roleLabel(person.role) }}</td>
                  <td>{{ person.hasLogin ? 'Login aktiv' : 'Login fehlt' }}</td>
                  <td>
                    <button type="button" class="secondary" (click)="edit(person)">
                      Bearbeiten</button
                    ><button
                      type="button"
                      class="secondary"
                      [disabled]="busy()"
                      (click)="removeCandidate.set(person)"
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
      <form id="staff-editor" class="form-panel" #form="ngForm" (ngSubmit)="save()">
        <h2>{{ selected ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter' }}</h2>
        <label for="firstname">Vorname</label
        ><input id="firstname" name="firstname" [(ngModel)]="firstname" required maxlength="100" />
        <label for="lastname">Nachname</label
        ><input id="lastname" name="lastname" [(ngModel)]="lastname" required maxlength="100" />
        <label for="staff-role">Rolle</label
        ><p-select
          inputId="staff-role"
          ariaLabel="Rolle"
          name="role"
          [options]="roles"
          optionLabel="label"
          optionValue="value"
          [(ngModel)]="role"
          appendTo="body"
        />
        <p class="muted">{{ roleHelp[role] }}</p>
        @if (!selected || !selected.hasLogin) {
          <label for="staff-email">E-Mail für den Login</label
          ><input
            id="staff-email"
            name="email"
            type="email"
            [(ngModel)]="email"
            required
            email
            autocomplete="off"
          />
          <label for="staff-password">Startpasswort</label
          ><input
            id="staff-password"
            name="password"
            type="password"
            [(ngModel)]="password"
            required
            minlength="12"
            maxlength="128"
            autocomplete="new-password"
          />
          <p class="muted">
            Mindestens 12 Zeichen. Das Teammitglied kann es unter „Mein Konto“ ändern.
          </p>
        }
        <div class="form-actions">
          <button type="submit" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Wird gespeichert …' : 'Speichern' }}</button
          ><button type="button" class="secondary" (click)="edit()">Zurücksetzen</button>
        </div>
      </form>
    </div>
    @if (removeCandidate(); as person) {
      <div class="confirmation-panel" role="alertdialog" aria-label="Mitarbeiter entfernen">
        <p>{{ person.firstname }} {{ person.lastname }} und dessen Login entfernen?</p>
        <button type="button" [disabled]="busy()" (click)="remove(person)">
          Entfernen bestätigen</button
        ><button type="button" class="secondary" (click)="removeCandidate.set(null)">
          Abbrechen
        </button>
      </div>
    }
  </section>`,
})
export class Personal {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly people = signal<Employee[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly removeCandidate = signal<Employee | null>(null);
  search = '';
  selected: Employee | null = null;
  firstname = '';
  lastname = '';
  email = '';
  password = '';
  role: EmployeeRole = 'SERVICE';
  readonly roles: { label: string; value: EmployeeRole }[] = [
    { label: 'Administration', value: 'ADMIN' },
    { label: 'Service', value: 'SERVICE' },
    { label: 'Küche', value: 'KITCHEN' },
    { label: 'Bar', value: 'BAR' },
  ];
  readonly roleHelp = {
    ADMIN: 'Verwaltet Mitarbeiter, Produkte, Zutaten und alle Bestellungen.',
    SERVICE: 'Betreut Tische, Bestellungen, Zahlung und Ausgabe.',
    KITCHEN: 'Sieht und bearbeitet ausschließlich Speisen und Vorspeisen.',
    BAR: 'Sieht und bearbeitet ausschließlich Getränke.',
  };
  // The form search is mutable; Angular reevaluates this getter on input.
  filtered(): Employee[] {
    const search = this.search.toLocaleLowerCase();
    return this.people().filter((person) =>
      `${person.firstname} ${person.lastname}`.toLocaleLowerCase().includes(search),
    );
  }
  roleLabel(role: EmployeeRole): string {
    return this.roles.find((option) => option.value === role)?.label ?? role;
  }
  constructor() {
    void this.load();
  }
  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.people.set(await firstValueFrom(this.http.get<Employee[]>('/api/employees')));
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  edit(person?: Employee, focus = true): void {
    this.selected = person ?? null;
    this.firstname = person?.firstname ?? '';
    this.lastname = person?.lastname ?? '';
    this.role = person?.role ?? 'SERVICE';
    this.email = '';
    this.password = '';
    this.error.set('');
    this.success.set('');
    if (focus) focusEditor('staff-editor');
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const profile = {
        firstname: this.firstname.trim(),
        lastname: this.lastname.trim(),
        role: this.role,
      };
      if (this.selected) {
        const id = this.selected.id;
        if (!this.selected.hasLogin)
          await firstValueFrom(
            this.http.post(`/api/employees/${id}/account`, {
              email: this.email.trim(),
              password: this.password,
            }),
          );
        await firstValueFrom(this.http.patch(`/api/employees/${id}`, profile));
      } else
        await firstValueFrom(
          this.http.post('/api/employees', {
            ...profile,
            email: this.email.trim(),
            password: this.password,
          }),
        );
      this.edit(undefined, false);
      this.success.set('Mitarbeiter gespeichert.');
      await this.load();
      await this.auth.refresh();
    } catch (error) {
      this.error.set(apiError(error));
      if (this.selected) {
        await this.load();
        const current = this.people().find((person) => person.id === this.selected?.id);
        if (current) this.selected = current;
      }
    } finally {
      this.password = '';
      this.busy.set(false);
    }
  }
  async remove(person: Employee): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.http.delete(`/api/employees/${person.id}`));
      this.removeCandidate.set(null);
      this.edit(undefined, false);
      this.success.set('Mitarbeiter entfernt.');
      await this.load();
      await this.auth.refresh();
    } catch (error) {
      this.error.set(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
