import { Route } from '@angular/router';
import { Startseite } from './pages/startseite/startseite';

export const appRoutes: Route[] = [
  {
    path: '',
    redirectTo: 'startseite',
    pathMatch: 'full',
  },
  {
    path: 'startseite',
    title: 'Startseite',
    component: Startseite,
  },
];
