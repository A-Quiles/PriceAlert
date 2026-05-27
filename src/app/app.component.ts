import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastComponent } from './shared/components/toast/toast.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastComponent],
  template: `
    @if (auth.isAuthenticated()) {
      <app-navbar />
    }
    <main class="min-h-screen">
      <router-outlet />
    </main>
    <app-toast />
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
