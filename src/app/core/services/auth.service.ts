import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { LoggerService } from './logger.service';

const CTX = 'AuthService';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly logger = inject(LoggerService);

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed<boolean>(() => !!this._session());

  constructor() {
    // Initialize session from storage
    this.supabase.client.auth.getSession().then(({ data, error }) => {
      if (error) {
        this.logger.supabaseError(CTX, 'getSession', error);
      } else {
        this.logger.info(
          CTX,
          `getSession: ${data.session ? 'sesión activa' : 'sin sesión'}`,
          {
            userId: data.session?.user?.id,
          },
        );
      }
      this._session.set(data.session);
      this._loading.set(false);
    });

    // Listen for auth state changes
    this.supabase.client.auth.onAuthStateChange((event, session) => {
      this.logger.info(CTX, `onAuthStateChange: ${event}`, {
        userId: session?.user?.id,
      });
      this._session.set(session);
      this._loading.set(false);
    });
  }

  async signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<{ error: AuthError | null }> {
    this.logger.info(CTX, 'signUp: registrando usuario', { email });
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      this.logger.error(CTX, 'signUp: error', {
        message: error.message,
        status: error.status,
      });
    } else if (data.user) {
      this.logger.info(CTX, 'signUp: usuario creado, creando perfil', {
        id: data.user.id,
      });
      const { error: profileError } = await this.supabase.client
        .from('profiles')
        .upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          email_notifications: true,
        });
      if (profileError) {
        this.logger.supabaseError(CTX, 'upsert profiles', profileError);
      }
    }

    return { error };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ error: AuthError | null }> {
    this.logger.info(CTX, 'signIn: iniciando sesión', { email });
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      this.logger.error(CTX, 'signIn: error', {
        message: error.message,
        status: error.status,
      });
    } else {
      this.logger.info(CTX, 'signIn: sesión iniciada correctamente');
    }
    return { error };
  }

  async signOut(): Promise<void> {
    this.logger.info(CTX, 'signOut');
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    this.logger.info(CTX, 'resetPassword', { email });
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      },
    );
    if (error) {
      this.logger.error(CTX, 'resetPassword: error', {
        message: error.message,
      });
    }
    return { error };
  }
}
