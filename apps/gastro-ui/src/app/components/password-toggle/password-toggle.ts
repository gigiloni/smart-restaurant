import { Component, input, signal } from '@angular/core';

@Component({
  selector: 'app-password-toggle',
  template: `
    <button
      type="button"
      class="password-toggle secondary"
      [attr.aria-label]="visible() ? 'Passwort verbergen' : 'Passwort anzeigen'"
      [attr.aria-pressed]="visible()"
      [attr.aria-controls]="field().id"
      (click)="toggle()"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        @if (visible()) {
          <path d="m3 3 18 18" />
        }
      </svg>
    </button>
  `,
})
export class PasswordToggle {
  readonly field = input.required<HTMLInputElement>();
  readonly visible = signal(false);

  toggle(): void {
    this.visible.update((visible) => !visible);
    this.field().type = this.visible() ? 'text' : 'password';
  }
}
