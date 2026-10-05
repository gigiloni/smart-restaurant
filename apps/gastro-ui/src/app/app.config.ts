import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { sessionInterceptor } from './services/session-interceptor';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import { GastroTheme } from './themes/gastro.theme';
export const appConfig: ApplicationConfig = {
  providers: [
    MessageService,
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideRouter(appRoutes),
    { provide: LOCALE_ID, useValue: 'de-DE' },
    providePrimeNG({ theme: { preset: GastroTheme, options: { darkModeSelector: true } } }),
  ],
};
