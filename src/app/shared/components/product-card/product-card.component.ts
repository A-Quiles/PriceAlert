import { Component, Input, Output, EventEmitter } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Product } from '../../../core/models';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Output() deleteProduct = new EventEmitter<string>();
  @Output() refreshProduct = new EventEmitter<string>();
  @Output() toggleAlert = new EventEmitter<{ id: string; enabled: boolean }>();

  isRefreshing = false;

  get priceChange(): number {
    if (!this.product.original_price || !this.product.current_price) return 0;
    return this.product.current_price - this.product.original_price;
  }

  get priceChangePercent(): number {
    if (!this.product.original_price || this.product.original_price === 0)
      return 0;
    return (this.priceChange / this.product.original_price) * 100;
  }

  get hasSavings(): boolean {
    return this.priceChange < 0;
  }

  get isAtThreshold(): boolean {
    if (!this.product.alert_threshold || !this.product.current_price)
      return false;
    return this.product.current_price <= this.product.alert_threshold;
  }

  get lastCheckedLabel(): string {
    if (!this.product.last_checked) return 'Nunca';
    const diff = Date.now() - new Date(this.product.last_checked).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  }

  onRefresh(): void {
    this.refreshProduct.emit(this.product.id);
  }

  onDelete(): void {
    this.deleteProduct.emit(this.product.id);
  }

  onToggleAlert(): void {
    this.toggleAlert.emit({
      id: this.product.id,
      enabled: !this.product.alert_enabled,
    });
  }
}
