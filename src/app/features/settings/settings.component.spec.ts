import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsComponent } from './settings.component';
import { ProfileService } from '../../core/services/profile.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/services/auth.service';
import { signal } from '@angular/core';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let profileService: jasmine.SpyObj<ProfileService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let authMock: {
    user: any;
    changeEmail: jasmine.Spy;
    changePassword: jasmine.Spy;
  };

  const baseProfile = {
    id: 'user-1',
    email: 'test@example.com',
    full_name: 'Test User',
    email_notifications: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    plan: 'free' as const,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };

  beforeEach(async () => {
    profileService = jasmine.createSpyObj('ProfileService', [
      'getProfile',
      'updateProfile',
    ]);
    toastService = jasmine.createSpyObj('ToastService', ['success', 'error']);
    authMock = {
      user: signal<any>({ email: 'test@example.com', id: 'user-1' }),
      changeEmail: jasmine
        .createSpy('changeEmail')
        .and.resolveTo({ error: null }),
      changePassword: jasmine
        .createSpy('changePassword')
        .and.resolveTo({ error: null }),
    };

    profileService.getProfile.and.resolveTo(baseProfile);

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: ProfileService, useValue: profileService },
        { provide: ToastService, useValue: toastService },
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('loads profile data on init', async () => {
    await fixture.whenStable();
    expect(profileService.getProfile).toHaveBeenCalled();
    expect(component.profileForm.value.full_name).toBe('Test User');
    expect(component.profileForm.value.email_notifications).toBe(true);
  });

  it('shows email address from auth', () => {
    expect(component.email).toBe('test@example.com');
  });

  it('saves settings successfully', async () => {
    profileService.updateProfile.and.resolveTo({
      ...baseProfile,
      full_name: 'New Name',
    });
    component.profileForm.patchValue({
      full_name: 'New Name',
      email_notifications: false,
    });

    await component.saveSettings();

    expect(profileService.updateProfile).toHaveBeenCalledWith({
      full_name: 'New Name',
      email_notifications: false,
    });
    expect(toastService.success).toHaveBeenCalledWith('Configuración guardada');
  });

  it('shows error toast when save fails', async () => {
    profileService.updateProfile.and.rejectWith(new Error('fail'));
    component.profileForm.patchValue({
      full_name: 'Test User',
      email_notifications: true,
    });

    await component.saveSettings();

    expect(toastService.error).toHaveBeenCalledWith(
      'Error al guardar la configuración',
    );
  });

  // ── Change email ─────────────────────────────────────────────────────────

  it('toggleEmailForm opens and closes the email form', () => {
    expect(component.showEmailForm()).toBeFalse();
    component.toggleEmailForm();
    expect(component.showEmailForm()).toBeTrue();
    component.toggleEmailForm();
    expect(component.showEmailForm()).toBeFalse();
  });

  it('submitEmailChange calls changeEmail and shows success toast', async () => {
    component.emailForm.patchValue({
      newEmail: 'nuevo@correo.com',
      confirmEmail: 'nuevo@correo.com',
      currentPasswordEmail: 'secret123',
    });

    await component.submitEmailChange();

    expect(authMock.changeEmail).toHaveBeenCalledWith(
      'secret123',
      'nuevo@correo.com',
    );
    expect(toastService.success).toHaveBeenCalled();
  });

  it('submitEmailChange shows error toast when changeEmail returns an error', async () => {
    const fakeError = { message: 'Invalid login credentials' } as any;
    authMock.changeEmail.and.resolveTo({ error: fakeError });
    component.emailForm.patchValue({
      newEmail: 'nuevo@correo.com',
      confirmEmail: 'nuevo@correo.com',
      currentPasswordEmail: 'wrongpass',
    });

    await component.submitEmailChange();

    expect(toastService.error).toHaveBeenCalledWith('Contraseña incorrecta');
  });

  it('submitEmailChange does nothing when new email equals current', async () => {
    component.emailForm.patchValue({
      newEmail: 'test@example.com',
      confirmEmail: 'test@example.com',
      currentPasswordEmail: 'secret123',
    });

    await component.submitEmailChange();

    expect(authMock.changeEmail).not.toHaveBeenCalled();
    expect(toastService.error).toHaveBeenCalledWith(
      'El nuevo correo es igual al actual',
    );
  });

  // ── Change password ───────────────────────────────────────────────────────

  it('togglePasswordForm opens and closes the password form', () => {
    expect(component.showPasswordForm()).toBeFalse();
    component.togglePasswordForm();
    expect(component.showPasswordForm()).toBeTrue();
    component.togglePasswordForm();
    expect(component.showPasswordForm()).toBeFalse();
  });

  it('submitPasswordChange calls changePassword and shows success toast', async () => {
    component.passwordForm.patchValue({
      currentPassword: 'oldpass123',
      newPassword: 'newpass456',
      confirmPassword: 'newpass456',
    });

    await component.submitPasswordChange();

    expect(authMock.changePassword).toHaveBeenCalledWith(
      'oldpass123',
      'newpass456',
    );
    expect(toastService.success).toHaveBeenCalled();
  });

  it('submitPasswordChange shows error toast when changePassword returns an error', async () => {
    const fakeError = { message: 'Invalid login credentials' } as any;
    authMock.changePassword.and.resolveTo({ error: fakeError });
    component.passwordForm.patchValue({
      currentPassword: 'wrongpass',
      newPassword: 'newpass456',
      confirmPassword: 'newpass456',
    });

    await component.submitPasswordChange();

    expect(toastService.error).toHaveBeenCalledWith(
      'Contraseña actual incorrecta',
    );
  });
});
