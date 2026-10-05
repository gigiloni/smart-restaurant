import { MessageService } from 'primeng/api';
import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { LiveSnapshot, OrderEvent, Viewer } from '@smart-restaurant/contracts';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth-service';
import { applyLiveEvent, emptyLiveState } from './live-state';

const EVENTS = [
  'session.opened',
  'session.moved',
  'session.closed',
  'order.created',
  'order.updated',
  'order.closed',
  'order.deleted',
  'item.created',
  'item.status_changed',
  'item.deleted',
  'inventory.updated',
];

@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly messages = inject(MessageService);
  private showError(detail: string): void {
    const alreadyReported = !!this.error();
    this.error.set(detail);
    if (!alreadyReported)
      this.messages.add({ severity: 'error', summary: 'Verbindung unterbrochen', detail });
  }
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly state = signal(emptyLiveState());
  readonly orders = computed(() => this.state().orders);
  readonly sessions = computed(() => this.state().sessions);
  readonly ingredients = computed(() => this.state().ingredients ?? []);
  readonly connection = signal<'idle' | 'loading' | 'connected' | 'reconnecting' | 'error'>('idle');
  readonly error = signal('');
  readonly visitEnded = signal(false);
  private source: EventSource | null = null;
  private epoch = 0;
  private key = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retry = 0;

  constructor() {
    effect(() => {
      const viewer = this.auth.viewer();
      const key =
        viewer?.kind === 'staff'
          ? `staff:${viewer.employeeId}:${viewer.role}`
          : viewer
            ? `guest:${viewer.tableSessionId}`
            : '';
      if (key === this.key) return;
      untracked(() => {
        const previousGuest = this.key.startsWith('guest:');
        this.key = key;
        this.stop();
        this.state.set(emptyLiveState());
        this.error.set('');
        this.visitEnded.set(previousGuest && !viewer);
        if (viewer) {
          this.visitEnded.set(false);
          this.reload();
        }
      });
    });
    const online = () => {
      if (this.auth.viewer()) this.reload();
    };
    window.addEventListener('online', online);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      window.removeEventListener('online', online);
    });
  }

  private stop(): void {
    this.epoch++;
    this.source?.close();
    this.source = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.connection.set('idle');
  }

  reload(): void {
    const viewer = this.auth.viewer();
    if (!viewer) return;
    this.stop();
    const epoch = this.epoch;
    this.connection.set('loading');
    void this.load(viewer, epoch);
  }

  private async load(viewer: Viewer, epoch: number): Promise<void> {
    try {
      const snapshot = await firstValueFrom(this.http.get<LiveSnapshot>('/api/live/snapshot'));
      if (epoch !== this.epoch) return;
      this.state.set({ ...snapshot, needsSnapshot: false });
      const guestSession =
        viewer.kind === 'guest'
          ? snapshot.sessions.find((session) => session.id === viewer.tableSessionId)
          : null;
      if (guestSession && viewer.kind === 'guest')
        this.auth.viewer.set({ ...viewer, tableId: guestSession.tableId });
      const source = new EventSource(`/api/live/events?since=${snapshot.cursor}`, {
        withCredentials: true,
      });
      this.source = source;
      for (const name of EVENTS)
        source.addEventListener(name, (message) => {
          if (epoch !== this.epoch) return;
          try {
            const event = JSON.parse((message as MessageEvent<string>).data) as OrderEvent;
            if (!Number.isSafeInteger(event.id) || event.type !== name)
              throw new Error('Invalid live event');
            const current = this.auth.viewer();
            const next = applyLiveEvent(
              this.state(),
              event,
              current?.kind === 'staff' ? current.role : undefined,
            );
            this.state.set(next);
            if (
              event.type === 'session.moved' &&
              current?.kind === 'guest' &&
              event.data.session.id === current.tableSessionId
            ) {
              this.auth.viewer.set({ ...current, tableId: event.data.session.tableId });
              void this.auth.refresh().catch(() => undefined);
            }
            if (
              event.type === 'session.closed' &&
              current?.kind === 'guest' &&
              event.data.session.id === current.tableSessionId
            ) {
              this.visitEnded.set(true);
              this.stop();
              void this.auth.refresh().catch(() => undefined);
            } else if (next.needsSnapshot) this.reload();
          } catch {
            this.reload();
          }
        });
      source.addEventListener('ready', (message) => {
        if (epoch !== this.epoch) return;
        let ready: { cursor: number };
        try {
          ready = JSON.parse((message as MessageEvent<string>).data) as { cursor: number };
          if (!Number.isSafeInteger(ready.cursor)) throw new Error('Invalid cursor');
        } catch {
          this.reload();
          return;
        }
        this.state.update((state) => ({ ...state, cursor: Math.max(state.cursor, ready.cursor) }));
        this.connection.set('connected');
        this.error.set('');
        this.retry = 0;
      });
      source.addEventListener('resync', () => {
        if (epoch !== this.epoch) return;
        source.close();
        void this.auth
          .refresh()
          .then(() => {
            if (epoch === this.epoch) this.reload();
          })
          .catch(() => this.scheduleRetry(epoch));
      });
      source.onerror = () => {
        if (epoch !== this.epoch) return;
        this.connection.set('reconnecting');
        this.showError('Live-Verbindung unterbrochen. Der zuletzt geladene Stand wird angezeigt.');
        void this.auth
          .refresh()
          .then(() => {
            if (epoch === this.epoch && source.readyState === EventSource.CLOSED)
              this.scheduleRetry(epoch);
          })
          .catch(() => this.scheduleRetry(epoch));
      };
    } catch {
      if (epoch !== this.epoch) return;
      this.connection.set('error');
      this.showError('Live-Daten konnten nicht geladen werden. Wir versuchen es erneut.');
      this.scheduleRetry(epoch);
    }
  }

  private scheduleRetry(epoch: number): void {
    if (this.timer || epoch !== this.epoch) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        if (epoch === this.epoch && this.auth.viewer()) this.reload();
      },
      Math.min(30_000, 2000 * 2 ** Math.min(this.retry++, 4)),
    );
  }
}
