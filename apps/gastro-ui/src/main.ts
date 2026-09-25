import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

registerLocaleData(localeDe, 'de-DE');
