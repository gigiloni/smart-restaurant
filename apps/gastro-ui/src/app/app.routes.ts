import { Route } from '@angular/router';
import { Startseite } from './pages/startseite/startseite';
import {Trefferliste} from "./components/trefferliste/trefferliste";
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
    path: 'warenkorb',
    title: 'Warenkorb',
    component: Warenkorb,
  },
];
