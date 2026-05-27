import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';

function matchFields(a: string, b: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const va = group.get(a)?.value;
    const vb = group.get(b)?.value;
    return va && vb && va !== vb ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  // ── Profile ──────────────────────────────────────────────────────────────
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly profileForm = new FormGroup({
    full_name: new FormControl<string | null>(null, Validators.required),
    email_notifications: new FormControl<boolean>(true),
  });

  // ── Change e-mail ─────────────────────────────────────────────────────────
  readonly showEmailForm = signal(false);
  readonly changingEmail = signal(false);
  readonly emailForm = new FormGroup(
    {
      newEmail: new FormControl('', [Validators.required, Validators.email]),
      confirmEmail: new FormControl('', [
        Validators.required,
        Validators.email,
      ]),
      currentPasswordEmail: new FormControl('', Validators.required),
    },
    { validators: matchFields('newEmail', 'confirmEmail') },
  );

  // ── Change password ───────────────────────────────────────────────────────
  readonly showPasswordForm = signal(false);
  readonly changingPassword = signal(false);
  readonly passwordForm = new FormGroup(
    {
      currentPassword: new FormControl('', Validators.required),
      newPassword: new FormControl('', [
        Validators.required,
        Validators.minLength(8),
      ]),
      confirmPassword: new FormControl('', Validators.required),
    },
    { validators: matchFields('newPassword', 'confirmPassword') },
  );

  get email(): string {
    return this.auth.user()?.email ?? '';
  }

  ngOnInit(): void {
    void this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    try {
      const profile = await this.profileService.getProfile();
      if (!profile) {
        this.toast.error('No se encontró el perfil');
        return;
      }
      this.profileForm.patchValue({
        full_name: profile.full_name,
        email_notifications: profile.email_notifications,
      });
    } catch {
      this.toast.error('Error al cargar la configuración');
    } finally {
      this.loading.set(false);
    }
  }

  async saveSettings(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      await this.profileService.updateProfile({
        full_name: this.profileForm.get('full_name')?.value ?? undefined,
        email_notifications:
          this.profileForm.get('email_notifications')?.value ?? false,
      });
      this.toast.success('Configuración guardada');
    } catch {
      this.toast.error('Error al guardar la configuración');
    } finally {
      this.saving.set(false);
    }
  }

  toggleEmailForm(): void {
    this.showEmailForm.update((v) => !v);
    if (!this.showEmailForm()) this.emailForm.reset();
  }

  async submitEmailChange(): Promise<void> {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const { newEmail, currentPasswordEmail } = this.emailForm.value;
    if (newEmail === this.email) {
      this.toast.error('El nuevo correo es igual al actual');
      return;
    }
    this.changingEmail.set(true);
    try {
      const { error } = await this.auth.changeEmail(
        currentPasswordEmail!,
        newEmail!,
      );
      if (error) {
        const msg = error.message.toLowerCase().includes('invalid')
          ? 'Contraseña incorrecta'
          : error.message;
        this.toast.error(msg);
      } else {
        this.toast.success(
          'Revisa tu bandeja: te hemos enviado un enlace de confirmación al nuevo correo',
        );
        this.toggleEmailForm();
      }
    } finally {
      this.changingEmail.set(false);
    }
  }

  togglePasswordForm(): void {
    this.showPasswordForm.update((v) => !v);
    if (!this.showPasswordForm()) this.passwordForm.reset();
  }

  async submitPasswordChange(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.changingPassword.set(true);
    try {
      const { error } = await this.auth.changePassword(
        currentPassword!,
        newPassword!,
      );
      if (error) {
        const msg = error.message.toLowerCase().includes('invalid')
          ? 'Contraseña actual incorrecta'
          : error.message;
        this.toast.error(msg);
      } else {
        this.toast.success('Contraseña actualizada correctamente');
        this.togglePasswordForm();
      }
    } finally {
      this.changingPassword.set(false);
    }
  }
}
