import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ProductsService } from '../../core/services/products.service';
import { AlertsService } from '../../core/services/alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { ToastService } from '../../core/services/toast.service';
import { Product } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, CommonModule, ProductCardComponent],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly alertsService = inject(AlertsService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly products = signal<Product[]>([]);
  readonly stats = signal({
    totalProducts: 0,
    activeAlerts: 0,
    triggeredAlerts: 0,
    avgSavings: 0,
  });

  ngOnInit(): void {
    void Promise.all([this.loadProducts(), this.loadStats()]).then(() => {
      this.loading.set(false);
    });
  }

  private async loadProducts(): Promise<void> {
    try {
      const data = await this.productsService.getProducts();
      this.products.set(data.slice(0, 6)); // Show latest 6 on dashboard
    } catch {
      this.toast.error('Error al cargar los productos');
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const data = await this.productsService.getDashboardStats();
      this.stats.set(data);
    } catch {}
  }

  async onRefreshProduct(id: string): Promise<void> {
    try {
      this.toast.info('Actualizando precio...');
      const updated = await this.productsService.refreshProduct(id);
      this.products.update((list) =>
        list.map((p) => (p.id === id ? updated : p)),
      );
      this.toast.success('Precio actualizado correctamente');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Error al actualizar el precio');
    }
  }

  async onDeleteProduct(id: string): Promise<void> {
    if (!confirm('¿Seguro que quieres dejar de rastrear este producto?'))
      return;
    try {
      await this.productsService.deleteProduct(id);
      this.products.update((list) => list.filter((p) => p.id !== id));
      this.stats.update((s) => ({ ...s, totalProducts: s.totalProducts - 1 }));
      this.toast.success('Producto eliminado');
    } catch {
      this.toast.error('Error al eliminar el producto');
    }
  }

  async onToggleAlert(event: { id: string; enabled: boolean }): Promise<void> {
    try {
      await this.productsService.updateProduct(event.id, {
        alert_enabled: event.enabled,
      });
      this.products.update((list) =>
        list.map((p) =>
          p.id === event.id ? { ...p, alert_enabled: event.enabled } : p,
        ),
      );
    } catch {
      this.toast.error('Error al actualizar la alerta');
    }
  }

  get userName(): string {
    return (
      this.auth.user()?.user_metadata?.['full_name'] ??
      this.auth.user()?.email?.split('@')[0] ??
      'Usuario'
    );
  }
}
