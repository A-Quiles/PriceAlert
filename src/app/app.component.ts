import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { CookieBannerComponent } from './shared/components/cookie-banner/cookie-banner.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastComponent, FooterComponent, CookieBannerComponent],
  template: `
    @if (auth.isAuthenticated()) {
      <app-navbar />
    }
    <main class="min-h-screen flex flex-col">
      <div class="flex-1">
        <router-outlet />
      </div>
      <app-footer />
    </main>
    <app-toast />
    <app-cookie-banner />
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
