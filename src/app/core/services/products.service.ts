import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Product, CreateProductDto, UpdateProductDto } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  async getProducts(): Promise<Product[]> {
    const userId = this.auth.user()?.id;
    if (!userId) return [];

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getProductById(id: string): Promise<Product | null> {
    const userId = this.auth.user()?.id;
    if (!userId) return null;

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return null;
    return data;
  }

  async addProduct(dto: CreateProductDto): Promise<Product> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    // Call the serverless scraper function
    const scrapeResponse = await fetch(`${environment.apiUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: dto.url }),
    });

    if (!scrapeResponse.ok) {
      const err = await scrapeResponse.json();
      throw new Error(err.message ?? 'Error al obtener datos del producto');
    }

    const scrapeData = await scrapeResponse.json();

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .insert({
        user_id: userId,
        url: dto.url,
        asin: scrapeData.asin,
        title: scrapeData.title,
        image_url: scrapeData.image_url,
        current_price: scrapeData.price,
        original_price: scrapeData.original_price,
        currency: scrapeData.currency ?? 'EUR',
        availability: scrapeData.availability,
        alert_threshold: dto.alert_threshold ?? null,
        alert_enabled: dto.alert_enabled ?? true,
        last_checked: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Save initial price history record
    if (scrapeData.price !== null) {
      await this.supabase.client.from('price_history').insert({
        product_id: data.id,
        price: scrapeData.price,
        currency: scrapeData.currency ?? 'EUR',
        availability: scrapeData.availability,
      });
    }

    return data;
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProduct(id: string): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) throw new Error('Not authenticated');

    const { error } = await this.supabase.client
      .from('tracked_products')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  }

  async refreshProduct(id: string): Promise<Product> {
    const product = await this.getProductById(id);
    if (!product) throw new Error('Producto no encontrado');

    const scrapeResponse = await fetch(`${environment.apiUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: product.url }),
    });

    if (!scrapeResponse.ok) throw new Error('Error al actualizar el precio');

    const scrapeData = await scrapeResponse.json();

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .update({
        current_price: scrapeData.price,
        original_price: scrapeData.original_price,
        availability: scrapeData.availability,
        image_url: scrapeData.image_url ?? product.image_url,
        last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Save to price history
    if (scrapeData.price !== null) {
      await this.supabase.client.from('price_history').insert({
        product_id: id,
        price: scrapeData.price,
        currency: product.currency,
        availability: scrapeData.availability,
      });
    }

    return data;
  }

  async getPriceHistory(productId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await this.supabase.client
      .from('price_history')
      .select('*')
      .eq('product_id', productId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getDashboardStats(): Promise<{
    totalProducts: number;
    activeAlerts: number;
    triggeredAlerts: number;
    avgSavings: number;
  }> {
    const userId = this.auth.user()?.id;
    if (!userId)
      return {
        totalProducts: 0,
        activeAlerts: 0,
        triggeredAlerts: 0,
        avgSavings: 0,
      };

    const { data: products } = await this.supabase.client
      .from('tracked_products')
      .select('current_price, original_price, alert_enabled')
      .eq('user_id', userId);

    const { data: alerts } = await this.supabase.client
      .from('alerts')
      .select('triggered')
      .eq('user_id', userId);

    const totalProducts = products?.length ?? 0;
    const activeAlerts = products?.filter((p) => p.alert_enabled).length ?? 0;
    const triggeredAlerts = alerts?.filter((a) => a.triggered).length ?? 0;

    const savings = products
      ?.filter((p) => p.original_price && p.current_price)
      .map((p) => p.original_price! - p.current_price!);

    const avgSavings =
      savings && savings.length > 0
        ? savings.reduce((a, b) => a + b, 0) / savings.length
        : 0;

    return { totalProducts, activeAlerts, triggeredAlerts, avgSavings };
  }
}
