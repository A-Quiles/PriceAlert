import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly showPassword = signal(false);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    const { email, password } = this.form.value;
    const { error } = await this.auth.signIn(email ?? '', password ?? '');

    if (error) {
      this.toast.error(this.mapError(error.message));
    } else {
      this.router.navigate(['/dashboard']);
    }

    this.loading.set(false);
  }

  private mapError(msg: string): string {
    if (msg.includes('Invalid login credentials'))
      return 'Email o contraseña incorrectos';
    if (msg.includes('Email not confirmed'))
      return 'Confirma tu email antes de iniciar sesión';
    return 'Error al iniciar sesión. Inténtalo de nuevo.';
  }
}
