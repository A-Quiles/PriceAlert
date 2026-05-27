export interface PriceHistory {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  recorded_at: string;
}

export interface PriceChartData {
  labels: string[];
  prices: number[];
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
}
