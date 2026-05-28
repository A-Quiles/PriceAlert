import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  {
    path: 'legal',
    loadChildren: () =>
      import('./features/legal/legal.routes').then((m) => m.LEGAL_ROUTES),
  },
  {
    path: 'precios',
    loadComponent: () =>
      import('./features/pricing/pricing.component').then(
        (m) => m.PricingComponent,
      ),
  },
  {
    path: 'auth',
    canActivate: [publicGuard],
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./features/products/products.routes').then(
        (m) => m.PRODUCTS_ROUTES,
      ),
  },
  {
    path: 'alerts',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/alerts/alerts.component').then(
        (m) => m.AlertsComponent,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
  },
  { path: '**', redirectTo: '/dashboard' },
];
