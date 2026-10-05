import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { appConfig } from './app/app.config';
import { App } from './app/app';
registerLocaleData(localeDe, 'de-DE');
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
