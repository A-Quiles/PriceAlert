export interface Alert {
  id: string;
  user_id: string;
  product_id: string;
  threshold_price: number;
  triggered: boolean;
  triggered_at: string | null;
  trigger_price: number | null;
  sent_email: boolean;
  created_at: string;
  product?: {
    title: string;
    url: string;
    image_url: string | null;
    current_price: number | null;
    currency: string;
  };
}

export interface AlertNotification {
  productTitle: string;
  productUrl: string;
  productImage: string | null;
  currentPrice: number;
  thresholdPrice: number;
  currency: string;
  userEmail: string;
}
