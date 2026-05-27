import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Product } from '../models';

@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  /** Devuelve todos los productos con alerta activa (= la "tabla" de alertas) */
  async getAlerts(): Promise<Product[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .select('*')
      .eq('user_id', userId)
      .eq('alert_enabled', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /** Desactiva la alerta del producto (no elimina el producto) */
  async deleteAlert(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await this.supabase.client
      .from('tracked_products')
      .update({
        alert_enabled: false,
        alert_triggered: false,
        alert_triggered_at: null,
        alert_trigger_price: null,
        alert_email_sent: false,
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  /** Reinicia el estado de disparado para volver a vigilar */
  async resetAlert(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await this.supabase.client
      .from('tracked_products')
      .update({
        alert_triggered: false,
        alert_triggered_at: null,
        alert_trigger_price: null,
        alert_email_sent: false,
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getTriggeredAlertsCount(): Promise<number> {
    const userId = this.auth.user()?.id;
    if (!userId) return 0;

    const { count } = await this.supabase.client
      .from('tracked_products')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('alert_enabled', true)
      .eq('alert_triggered', true);

    return count ?? 0;
  }
}
