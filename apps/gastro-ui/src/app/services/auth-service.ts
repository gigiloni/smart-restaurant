import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { Employee, EmployeeRole, EnterAsGuestDto, Viewer } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { CartService } from './cart-service';
import { TableService } from './table-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly cart = inject(CartService);
  private readonly tables = inject(TableService);
  readonly viewer = signal<Viewer | null>(null);
  readonly employee = signal<Employee | null>(null);
  readonly initialized = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly staff = computed(() => {
    const viewer = this.viewer();
    return viewer?.kind === 'staff' ? viewer : null;
  });
  readonly guest = computed(() => {
    const viewer = this.viewer();
    return viewer?.kind === 'guest' ? viewer : null;
  });
  private pending: Promise<Viewer | null> | null = null;
  private readonly channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('sr.auth') : null;

  constructor() {
    const refresh = () => {
      void this.refresh().catch(() => undefined);
    };
    const focus = () => {
      if (this.initialized()) refresh();
    };
    this.channel?.addEventListener('message', refresh);
    window.addEventListener('focus', focus);
    const timer = window.setInterval(() => {
      if (this.viewer()) refresh();
    }, 60_000);
    inject(DestroyRef).onDestroy(() => {
      this.channel?.close();
      window.removeEventListener('focus', focus);
      clearInterval(timer);
    });
  }

  ensure(): Promise<Viewer | null> {
    return this.initialized() ? Promise.resolve(this.viewer()) : this.refresh();
  }

  refresh(): Promise<Viewer | null> {
    if (this.pending) return this.pending;
    this.loading.set(true);
    this.pending = this.load().finally(() => {
      this.loading.set(false);
      this.pending = null;
    });
    return this.pending;
  }

  private async load(): Promise<Viewer | null> {
    try {
      const viewer = await firstValueFrom(this.http.get<Viewer | null>('/api/viewer'));
      const employee =
        viewer?.kind === 'staff'
          ? await firstValueFrom(this.http.get<Employee>('/api/employees/me'))
          : null;
      const previous = this.viewer();
      const oldIdentity =
        previous?.kind === 'guest'
          ? `guest:${previous.tableSessionId}`
          : previous?.kind === 'staff'
            ? `staff:${previous.employeeId}`
            : '';
      const newIdentity =
        viewer?.kind === 'guest'
          ? `guest:${viewer.tableSessionId}`
          : viewer?.kind === 'staff'
            ? `staff:${viewer.employeeId}`
            : '';
      let cartIdentity = oldIdentity;
      try {
        cartIdentity ||= sessionStorage.getItem('sr.cart.scope.v1') ?? '';
      } catch {
        /* In-memory state still works. */
      }
      if (cartIdentity && cartIdentity !== newIdentity) this.cart.clear();
      try {
        if (newIdentity) sessionStorage.setItem('sr.cart.scope.v1', newIdentity);
        else sessionStorage.removeItem('sr.cart.scope.v1');
      } catch {
        /* This value never grants access. */
      }
      this.viewer.set(viewer);
      this.employee.set(employee);
      this.tables.bindGuest(viewer?.kind === 'guest' ? viewer.tableId : null);
      this.initialized.set(true);
      this.error.set('');
      return viewer;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        this.cart.clear();
        this.viewer.set(null);
        this.employee.set(null);
        this.tables.bindGuest(null);
        this.initialized.set(true);
      }
      this.error.set('Der Zugang konnte nicht geprüft werden. Bitte erneut versuchen.');
      throw error;
    }
  }

  async signIn(email: string, password: string, rememberMe: boolean): Promise<void> {
    if (this.pending) await this.pending.catch(() => undefined);
    await firstValueFrom(
      this.http.post('/api/auth/sign-in/email', { email: email.trim(), password, rememberMe }),
    );
    await this.refresh();
    this.channel?.postMessage('changed');
    if (!this.staff()) throw new Error('Für dieses Konto ist kein Mitarbeiterprofil hinterlegt.');
  }

  async signOut(): Promise<void> {
    if (this.pending) await this.pending.catch(() => undefined);
    await firstValueFrom(this.http.post('/api/auth/sign-out', {}));
    await this.refresh();
    this.channel?.postMessage('changed');
  }

  async enterGuest(dto: EnterAsGuestDto): Promise<void> {
    if (this.pending) await this.pending.catch(() => undefined);
    await firstValueFrom(this.http.post('/api/viewer/guest', dto));
    await this.refresh();
    this.channel?.postMessage('changed');
  }

  hasRole(...roles: EmployeeRole[]): boolean {
    const staff = this.staff();
    return !!staff && roles.includes(staff.role);
  }
}
