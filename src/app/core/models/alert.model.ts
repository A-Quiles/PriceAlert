// Las alertas ahora viven directamente en tracked_products
export type { Product as Alert } from './product.model';

export interface AlertNotification {
  productTitle: string;
  productUrl: string;
  productImage: string | null;
  currentPrice: number;
  thresholdPrice: number;
  currency: string;
  userEmail: string;
}
