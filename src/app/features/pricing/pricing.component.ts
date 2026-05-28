import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './pricing.component.html',
})
export class PricingComponent {
  readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async subscribePremium(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      window.location.href = '/auth/register';
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.auth.user()?.email,
          userId: this.auth.user()?.id,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        throw new Error(data.message ?? 'Error al crear la sesión de pago');
      }

      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      this.loading.set(false);
    }
  }
}
