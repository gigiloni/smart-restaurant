import { Route } from '@angular/router';
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
  { path: '**', redirectTo: 'startseite' },
];
