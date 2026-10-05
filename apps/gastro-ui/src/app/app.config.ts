import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { GastroTheme } from './themes/gastro.theme';
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(appRoutes),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    providePrimeNG({ theme: { preset: GastroTheme, options: { darkModeSelector: true } } }),
  ],
};
