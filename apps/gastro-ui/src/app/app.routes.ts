import { Route } from '@angular/router';
import { staffGuard } from './services/auth-guards';
export const appRoutes: Route[] = [
  { path: '', redirectTo: 'startseite', pathMatch: 'full' },
  {
    path: 'startseite',
    title: 'Willkommen | Bellavista',
    loadComponent: () =>
      import('./pages/startseite/startseite').then((module) => module.Startseite),
  },
  {
    path: 'speisekarte',
    title: 'Speisekarte | Bellavista',
    loadComponent: () =>
      import('./pages/speisekarte/speisekarte').then((module) => module.Speisekarte),
  },
  {
    path: 'warenkorb',
    title: 'Warenkorb | Bellavista',
    loadComponent: () => import('./pages/warenkorb/warenkorb').then((module) => module.Warenkorb),
  },
  { path: 'menu', redirectTo: 'speisekarte', pathMatch: 'full' },
  {
    path: 'anmelden',
    title: 'Mitarbeiter-Anmeldung | Bellavista',
    loadComponent: () => import('./pages/anmelden/anmelden').then((m) => m.Anmelden),
  },
  { path: 'gastzugang', redirectTo: 'startseite', pathMatch: 'full' },
  {
    path: 'bestellungen',
    title: 'Meine Bestellungen | Bellavista',
    loadComponent: () => import('./pages/bestellungen/bestellungen').then((m) => m.Bestellungen),
  },
  {
    path: 'mitarbeiter',
    canActivate: [staffGuard],
    loadChildren: () =>
      import('./pages/mitarbeiter/mitarbeiter.routes').then((m) => m.mitarbeiterRoutes),
  },
  { path: '**', redirectTo: 'startseite' },
];
