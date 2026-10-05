import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
interface Credit {
  name: string;
  src: string;
  author: string;
  source: string;
  license: string;
  licenseUrl: string;
  changes: string;
}
@Component({
  selector: 'app-bildnachweise',
  template: `<main class="page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">Fotografie</span>
        <h2>Bildnachweise</h2>
        <p>Gerichtsfotos von Wikimedia Commons. Abbildungen sind Serviervorschläge.</p>
      </div>
    </div>
    @if (error()) {
      <p role="alert">Bildnachweise konnten nicht geladen werden.</p>
    }
    <div class="credits-grid">
      @for (credit of credits(); track credit.src) {
        <article>
          <img [src]="credit.src" [alt]="credit.name" width="240" height="150" loading="lazy" />
          <h4>{{ credit.name }}</h4>
          <p>{{ credit.author }}</p>
          <p>
            <a [href]="credit.source" target="_blank" rel="noopener noreferrer"
              >Original und Quelle</a
            >
            ·
            <a [href]="credit.licenseUrl" target="_blank" rel="noopener noreferrer">{{
              credit.license
            }}</a>
          </p>
          <p>{{ credit.changes }}</p>
        </article>
      }
    </div>
  </main>`,
  styles: [
    `
      .credits-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.5rem;
      }
      article {
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
      }
      img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: var(--radius-md);
      }
      h4 {
        font-size: 1.5rem;
        margin: 0.8rem 0;
      }
      article p {
        font: 0.8rem/1.6 var(--font-ui);
        color: var(--text-muted);
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class Bildnachweise {
  private readonly http = inject(HttpClient);
  protected readonly credits = signal<Credit[]>([]);
  protected readonly error = signal(false);
  constructor() {
    this.http
      .get<Credit[]>('/dishes/image-credits.json')
      .subscribe({
        next: (credits) => this.credits.set(credits),
        error: () => this.error.set(true),
      });
  }
}
