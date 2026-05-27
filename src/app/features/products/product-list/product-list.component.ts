import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductCardComponent } from '../../../shared/components/product-card/product-card.component';
import { Product } from '../../../core/models';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule, ProductCardComponent],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly refreshingAll = signal(false);
  readonly allProducts = signal<Product[]>([]);
  searchQuery = '';

  get filteredProducts(): Product[] {
    if (!this.searchQuery.trim()) return this.allProducts();
    const q = this.searchQuery.toLowerCase();
    return this.allProducts().filter(
      (p) =>
        p.title.toLowerCase().includes(q) || p.asin.toLowerCase().includes(q),
    );
  }

  async ngOnInit(): Promise<void> {
    await this.loadProducts();
  }

  private async loadProducts(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.productsService.getProducts();
      this.allProducts.set(data);
    } catch {
      this.toast.error('Error al cargar los productos');
    } finally {
      this.loading.set(false);
    }
  }

  async onRefreshProduct(id: string): Promise<void> {
    try {
      this.toast.info('Actualizando precio...');
      const updated = await this.productsService.refreshProduct(id);
      this.allProducts.update((list) =>
        list.map((p) => (p.id === id ? updated : p)),
      );
      this.toast.success('Precio actualizado');
    } catch (e: any) {
      this.toast.error(e.message ?? 'Error al actualizar');
    }
  }

  async onDeleteProduct(id: string): Promise<void> {
    if (!confirm('¿Seguro que quieres eliminar este producto?')) return;
    try {
      await this.productsService.deleteProduct(id);
      this.allProducts.update((list) => list.filter((p) => p.id !== id));
      this.toast.success('Producto eliminado');
    } catch {
      this.toast.error('Error al eliminar');
    }
  }

  async onToggleAlert(event: { id: string; enabled: boolean }): Promise<void> {
    try {
      await this.productsService.updateProduct(event.id, {
        alert_enabled: event.enabled,
      });
      this.allProducts.update((list) =>
        list.map((p) =>
          p.id === event.id ? { ...p, alert_enabled: event.enabled } : p,
        ),
      );
    } catch {
      this.toast.error('Error al actualizar la alerta');
    }
  }

  async refreshAll(): Promise<void> {
    this.refreshingAll.set(true);
    const products = this.allProducts();
    let updated = 0;

    for (const product of products) {
      try {
        const refreshed = await this.productsService.refreshProduct(product.id);
        this.allProducts.update((list) =>
          list.map((p) => (p.id === product.id ? refreshed : p)),
        );
        updated++;
      } catch {}
    }

    this.toast.success(
      `${updated} / ${products.length} productos actualizados`,
    );
    this.refreshingAll.set(false);
  }
}
