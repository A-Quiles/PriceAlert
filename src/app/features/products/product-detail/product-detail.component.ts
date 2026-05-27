import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { AlertsService } from '../../../core/services/alerts.service';
import { ToastService } from '../../../core/services/toast.service';
import { PriceChartComponent } from '../../../shared/components/price-chart/price-chart.component';
import { Product, PriceHistory, Alert } from '../../../core/models';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [RouterLink, CommonModule, ReactiveFormsModule, PriceChartComponent],
  templateUrl: './product-detail.component.html',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsService = inject(ProductsService);
  private readonly alertsService = inject(AlertsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly product = signal<Product | null>(null);
  readonly history = signal<PriceHistory[]>([]);
  readonly alerts = signal<Alert[]>([]);
  readonly showAlertForm = signal(false);
  readonly historyDays = signal(30);

  alertForm = this.fb.group({
    threshold: [
      null as number | null,
      [Validators.required, Validators.min(0)],
    ],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/products']);
      return;
    }

    void Promise.all([
      this.loadProduct(id),
      this.loadHistory(id),
      this.loadAlerts(id),
    ]).then(() => {
      this.loading.set(false);
    });
  }

  private async loadProduct(id: string): Promise<void> {
    const data = await this.productsService.getProductById(id);
    if (!data) {
      this.router.navigate(['/products']);
      return;
    }
    this.product.set(data);
    this.alertForm.patchValue({ threshold: data.alert_threshold });
  }

  private async loadHistory(id: string): Promise<void> {
    try {
      const data = await this.productsService.getPriceHistory(
        id,
        this.historyDays(),
      );
      this.history.set(data);
    } catch {}
  }

  private async loadAlerts(id: string): Promise<void> {
    try {
      const all = await this.alertsService.getAlerts();
      this.alerts.set(all.filter((a) => a.id === id));
    } catch {}
  }

  async onRefresh(): Promise<void> {
    const product = this.product();
    if (!product) return;
    this.refreshing.set(true);
    try {
      const updated = await this.productsService.refreshProduct(product.id);
      this.product.set(updated);
      await this.loadHistory(product.id);
      this.toast.success('Precio actualizado');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Error al actualizar');
    } finally {
      this.refreshing.set(false);
    }
  }

  async onDelete(): Promise<void> {
    const product = this.product();
    if (!product) return;
    if (!confirm('¿Quieres dejar de rastrear este producto?')) return;
    try {
      await this.productsService.deleteProduct(product.id);
      this.toast.success('Producto eliminado');
      this.router.navigate(['/products']);
    } catch {
      this.toast.error('Error al eliminar el producto');
    }
  }

  async saveAlertThreshold(): Promise<void> {
    const product = this.product();
    const threshold = this.alertForm.value.threshold;
    if (!product || this.alertForm.invalid) return;

    try {
      const updated = await this.productsService.updateProduct(product.id, {
        alert_threshold: threshold,
        alert_enabled: true,
      });
      this.product.set(updated);
      this.showAlertForm.set(false);
      this.toast.success('Alerta configurada correctamente');
    } catch {
      this.toast.error('Error al guardar la alerta');
    }
  }

  async deleteAlert(id: string): Promise<void> {
    try {
      await this.alertsService.deleteAlert(id);
      this.alerts.update((list) => list.filter((a) => a.id !== id));
      this.toast.success('Alerta eliminada');
    } catch {
      this.toast.error('Error al eliminar la alerta');
    }
  }

  async changeHistoryDays(days: number): Promise<void> {
    this.historyDays.set(days);
    const product = this.product();
    if (product) await this.loadHistory(product.id);
  }

  get priceMin(): number {
    if (!this.history().length) return this.product()?.current_price ?? 0;
    return Math.min(...this.history().map((h) => h.price));
  }

  get priceMax(): number {
    if (!this.history().length) return this.product()?.current_price ?? 0;
    return Math.max(...this.history().map((h) => h.price));
  }

  openAmazon(): void {
    const url = this.product()?.url;
    if (!url || !/^https?:\/\/(www\.)?amazon\./i.test(url)) {
      this.toast.error('URL de Amazon inválida o no disponible.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
