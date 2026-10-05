import { Route } from '@angular/router';
import { Startseite } from './pages/startseite/startseite';
import { Speisekarte } from './pages/speisekarte/speisekarte';
import {Warenkorb} from "./pages/warenkorb/warenkorb";

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
  {
    path: 'speisekarte',
    title: 'Speisekarte',
    component: Speisekarte,
  },
  {
    path: 'warenkorb',
    title: 'Warenkorb',
    component: Warenkorb,
  },
];
