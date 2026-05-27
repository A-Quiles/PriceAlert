import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  private readonly _session = signal<Session | null>(null);
  private readonly _loading = signal<boolean>(true);

  readonly session = this._session.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly user = computed<User | null>(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed<boolean>(() => !!this._session());

  constructor() {
    // Initialize session from storage
    this.supabase.client.auth.getSession().then(({ data }) => {
      this._session.set(data.session);
      this._loading.set(false);
    });

    // Listen for auth state changes
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      this._loading.set(false);
    });
  }

  async signUp(
    email: string,
    password: string,
    fullName: string,
  ): Promise<{ error: AuthError | null }> {
    const { data, error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (!error && data.user) {
      // Create user profile
      await this.supabase.client.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        email_notifications: true,
      });
    }

    return { error };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async signOut(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/auth/login']);
  }

  async resetPassword(email: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabase.client.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      },
    );
    return { error };
  }
}
