import { Routes } from '@angular/router';

export const LEGAL_ROUTES: Routes = [
  {
    path: 'aviso-legal',
    loadComponent: () =>
      import('./legal-notice/legal-notice.component').then(
        (m) => m.LegalNoticeComponent,
      ),
  },
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'terminos',
    loadComponent: () =>
      import('./terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'cookies',
    loadComponent: () =>
      import('./cookies/cookies.component').then((m) => m.CookiesComponent),
  },
  { path: '', redirectTo: 'aviso-legal', pathMatch: 'full' },
];
