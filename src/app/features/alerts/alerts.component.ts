import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AlertsService } from '../../core/services/alerts.service';
import { ToastService } from '../../core/services/toast.service';
import { Product } from '../../core/models';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './alerts.component.html',
})
export class AlertsComponent implements OnInit {
  private readonly alertsService = inject(AlertsService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly alerts = signal<Product[]>([]);

  get triggeredAlerts(): Product[] {
    return this.alerts().filter((a) => a.alert_triggered);
  }

  get pendingAlerts(): Product[] {
    return this.alerts().filter((a) => !a.alert_triggered);
  }

  async ngOnInit(): Promise<void> {
    await this.loadAlerts();
  }

  private async loadAlerts(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.alertsService.getAlerts();
      this.alerts.set(data);
    } catch {
      this.toast.error('Error al cargar las alertas');
    } finally {
      this.loading.set(false);
    }
  }

  async onDelete(id: string): Promise<void> {
    if (!confirm('¿Desactivar esta alerta?')) return;
    try {
      await this.alertsService.deleteAlert(id);
      this.alerts.update((list) => list.filter((a) => a.id !== id));
      this.toast.success('Alerta desactivada');
    } catch {
      this.toast.error('Error al desactivar la alerta');
    }
  }

  async onReset(id: string): Promise<void> {
    try {
      await this.alertsService.resetAlert(id);
      this.alerts.update((list) =>
        list.map((a) =>
          a.id === id
            ? {
                ...a,
                alert_triggered: false,
                alert_triggered_at: null,
                alert_trigger_price: null,
              }
            : a,
        ),
      );
      this.toast.success('Alerta reiniciada');
    } catch {
      this.toast.error('Error al reiniciar la alerta');
    }
  }
}
