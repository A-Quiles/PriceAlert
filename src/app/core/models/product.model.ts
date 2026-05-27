export interface Product {
  id: string;
  user_id: string;
  title: string;
  url: string;
  asin: string;
  image_url: string | null;
  current_price: number | null;
  original_price: number | null;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  alert_threshold: number | null;
  alert_enabled: boolean;
  alert_triggered: boolean;
  alert_triggered_at: string | null;
  alert_trigger_price: number | null;
  alert_email_sent: boolean;
  last_checked: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductDto {
  url: string;
  alert_threshold?: number | null;
  alert_enabled?: boolean;
}

export interface UpdateProductDto {
  alert_threshold?: number | null;
  alert_enabled?: boolean;
}

export interface ScrapeResult {
  title: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  image_url: string | null;
  asin: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
}
