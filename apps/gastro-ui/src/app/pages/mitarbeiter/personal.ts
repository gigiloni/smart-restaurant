import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import type { Employee, EmployeeRole } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { apiError } from '../../services/api-error';
import { AuthService } from '../../services/auth-service';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-personal',
  imports: [FormsModule, SelectModule, DialogModule],
  templateUrl: './personal.html',
})
export class Personal {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    this.error.set(detail);
    this.messages.add({ severity: 'error', summary: 'Fehler', detail });
  }
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly people = signal<Employee[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  editorOpen = false;
  readonly error = signal('');
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
      this.showError(apiError(error));
    } finally {
      this.loading.set(false);
    }
  }
  edit(person?: Employee, open = true): void {
    this.selected = person ?? null;
    this.firstname = person?.firstname ?? '';
    this.lastname = person?.lastname ?? '';
    this.role = person?.role ?? 'SERVICE';
    this.email = '';
    this.password = '';
    this.error.set('');
    this.editorOpen = open;
  }
  async save(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
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
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Mitarbeiter gespeichert.',
      });
      await this.load();
      await this.auth.refresh();
    } catch (error) {
      this.showError(apiError(error));
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
      this.messages.add({
        severity: 'success',
        summary: 'Erfolgreich',
        detail: 'Mitarbeiter entfernt.',
      });
      await this.load();
      await this.auth.refresh();
    } catch (error) {
      this.showError(apiError(error));
    } finally {
      this.busy.set(false);
    }
  }
}
