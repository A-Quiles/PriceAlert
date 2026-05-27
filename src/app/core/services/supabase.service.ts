import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly _client: SupabaseClient;

  constructor() {
    this._client = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Evita NavigatorLockAcquireTimeoutError: reemplaza la implementación
          // del Web Lock por una que espera en vez de fallar inmediatamente.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lock: async <R>(
            name: string,
            _acquireTimeout: number,
            fn: () => Promise<R>,
          ): Promise<R> => {
            if (typeof navigator !== 'undefined' && navigator.locks) {
              return navigator.locks.request(name, fn);
            }
            return fn();
          },
        },
      },
    );
  }

  get client(): SupabaseClient {
    return this._client;
  }
}
