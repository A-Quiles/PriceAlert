import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Alert } from '../models';

@Injectable({
  providedIn: 'root',
})
export class AlertsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async getAlerts(): Promise<Alert[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.supabase.client
      .from('alerts')
      .select(
        `
        *,
        product:tracked_products (
          title,
          url,
          image_url,
          current_price,
          currency
        )
      `,
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async createAlert(productId: string, thresholdPrice: number): Promise<Alert> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.supabase.client
      .from('alerts')
      .insert({
        user_id: userId,
        product_id: productId,
        threshold_price: thresholdPrice,
        triggered: false,
        sent_email: false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAlert(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await this.supabase.client
      .from('alerts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async resetAlert(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await this.supabase.client
      .from('alerts')
      .update({
        triggered: false,
        triggered_at: null,
        trigger_price: null,
        sent_email: false,
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async getTriggeredAlertsCount(): Promise<number> {
    const userId = this.auth.user()?.id;
    if (!userId) return 0;

    const { count } = await this.supabase.client
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('triggered', true);

    return count ?? 0;
  }
}
