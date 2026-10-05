import { Routes } from '@angular/router';
import { staffGuard } from '../../services/auth-guards';

export const mitarbeiterRoutes: Routes = [
  {
    path: '',
    canActivateChild: [staffGuard],
    loadComponent: () => import('./mitarbeiter').then((m) => m.Mitarbeiter),
    children: [
      {
        path: '',
        title: 'Live-Bestellungen | Bellavista',
        loadComponent: () => import('./live-board').then((m) => m.LiveBoard),
      },
      {
        path: 'personal',
        data: { roles: ['ADMIN'] },
        title: 'Mitarbeiter | Bellavista',
        loadComponent: () => import('./personal').then((m) => m.Personal),
      },
      {
        path: 'produkte',
        data: { roles: ['ADMIN'] },
        title: 'Produkte | Bellavista',
        loadComponent: () => import('./produkte').then((m) => m.Produkte),
      },
      {
        path: 'zutaten',
        data: { roles: ['ADMIN'] },
        title: 'Zutaten & Bestand | Bellavista',
        loadComponent: () => import('./zutaten').then((m) => m.Zutaten),
      },
      {
        path: 'konto',
        title: 'Mein Konto | Bellavista',
        loadComponent: () => import('./konto').then((m) => m.Konto),
      },
    ],
  },
];
