import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { Product, CreateProductDto, UpdateProductDto } from '../models';
import { environment } from '../../../environments/environment';

const CTX = 'ProductsService';

@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly logger = inject(LoggerService);

  async getProducts(): Promise<Product[]> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.logger.warn(CTX, 'getProducts: usuario no autenticado');
      return [];
    }
    this.logger.debug(CTX, 'getProducts: cargando productos', { userId });

    const { data, error } = await this.supabase.client
      .from('tracked_products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.supabaseError(CTX, 'getProducts', error);
      throw error;
    }
    this.logger.info(
      CTX,
      `getProducts: ${data?.length ?? 0} productos cargados`,
    );
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
    if (!userId) {
      this.logger.error(CTX, 'addProduct: usuario no autenticado');
      throw new Error('Not authenticated');
    }

    const scrapeUrl = `${environment.apiUrl}/api/scrape`;
    this.logger.info(CTX, `addProduct: llamando scraper → ${scrapeUrl}`, {
      url: dto.url,
    });

    let scrapeResponse: Response;
    try {
      scrapeResponse = await fetch(scrapeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: dto.url }),
      });
    } catch (netError) {
      this.logger.fetchError(CTX, scrapeUrl, netError);
      throw new Error(
        'No se pudo conectar con el servidor de scraping. ' +
          "¿Está corriendo 'vercel dev' en otro terminal?",
      );
    }

    this.logger.debug(
      CTX,
      `addProduct: respuesta scraper HTTP ${scrapeResponse.status}`,
    );

    if (!scrapeResponse.ok) {
      let errBody: { message?: string } = {};
      try {
        errBody = await scrapeResponse.json();
      } catch {
        /* ignore */
      }
      const cause =
        scrapeResponse.status === 404
          ? 'Endpoint no encontrado (HTTP 404). Comprueba que "vercel dev" está corriendo ' +
            'en el puerto 3000 y que has reiniciado "ng serve" después de añadir proxy.conf.json.'
          : (errBody.message ??
            `Error del scraper (HTTP ${scrapeResponse.status})`);
      this.logger.error(
        CTX,
        `addProduct: scraper error HTTP ${scrapeResponse.status} → ${cause}`,
        errBody,
      );
      throw new Error(cause);
    }

    const scrapeData = await scrapeResponse.json();
    this.logger.info(CTX, 'addProduct: datos scrapeados', {
      asin: scrapeData.asin,
      title: scrapeData.title?.substring(0, 50),
      price: scrapeData.price,
      currency: scrapeData.currency,
    });

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

    if (error) {
      this.logger.supabaseError(CTX, 'insert tracked_products', error);
      throw error;
    }
    this.logger.info(CTX, `addProduct: producto insertado en BD`, {
      id: data.id,
    });

    // Save initial price history record
    if (scrapeData.price !== null) {
      const { error: histError } = await this.supabase.client
        .from('price_history')
        .insert({
          product_id: data.id,
          price: scrapeData.price,
          currency: scrapeData.currency ?? 'EUR',
          availability: scrapeData.availability,
        });
      if (histError) {
        this.logger.warn(
          CTX,
          'addProduct: no se pudo guardar historial inicial',
          histError,
        );
      }
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

    const scrapeUrl = `${environment.apiUrl}/api/scrape`;
    this.logger.info(CTX, `refreshProduct: actualizando precio`, {
      id,
      url: product.url,
    });

    let scrapeResponse: Response;
    try {
      scrapeResponse = await fetch(scrapeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: product.url }),
      });
    } catch (netError) {
      this.logger.fetchError(CTX, scrapeUrl, netError);
      throw new Error('No se pudo conectar con el servidor de scraping.');
    }

    if (!scrapeResponse.ok) {
      this.logger.error(CTX, `refreshProduct: HTTP ${scrapeResponse.status}`);
      throw new Error(
        `Error al actualizar el precio (HTTP ${scrapeResponse.status})`,
      );
    }

    const scrapeData = await scrapeResponse.json();
    this.logger.debug(CTX, 'refreshProduct: datos recibidos', {
      price: scrapeData.price,
    });

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
