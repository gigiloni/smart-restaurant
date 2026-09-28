import { Route } from '@angular/router';
import { Startseite } from './pages/startseite/startseite';
import {Trefferliste} from "./components/trefferliste/trefferliste";

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
    path: 'menu',
    title: 'Menü',
    component: Trefferliste,
  },
  {
    path: 'warenkorb',
    title: 'Warenkorb',
    component: Trefferliste,
  },
];
