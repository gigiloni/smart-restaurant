import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { providePrimeNG } from 'primeng/config';
import { GastroTheme } from './themes/gastro.theme';
import { MessageService } from 'primeng/api'

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(appRoutes),
    providePrimeNG({
      theme: {
        preset: GastroTheme,
        options: {
          darkModeSelector: false,
        },
      },
    }),
    MessageService,
  ],
};
