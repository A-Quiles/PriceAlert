import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AlertsComponent } from './alerts.component';
import { AlertsService } from '../../core/services/alerts.service';
import { ToastService } from '../../core/services/toast.service';
import { RouterTestingModule } from '@angular/router/testing';
import { Product } from '../../core/models';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    user_id: 'u1',
    title: 'Test Product',
    url: 'https://amazon.es/dp/B001',
    asin: 'B001',
    image_url: null,
    current_price: 100,
    original_price: 120,
    currency: 'EUR',
    availability: 'in_stock',
    alert_threshold: 90,
    alert_enabled: true,
    alert_triggered: false,
    alert_triggered_at: null,
    alert_trigger_price: null,
    alert_email_sent: false,
    last_checked: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('AlertsComponent', () => {
  let component: AlertsComponent;
  let fixture: ComponentFixture<AlertsComponent>;
  let alertsService: jasmine.SpyObj<AlertsService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    alertsService = jasmine.createSpyObj('AlertsService', [
      'getAlerts',
      'deleteAlert',
      'resetAlert',
    ]);
    toastService = jasmine.createSpyObj('ToastService', ['error', 'success']);
    alertsService.getAlerts.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [AlertsComponent, RouterTestingModule],
      providers: [
        { provide: AlertsService, useValue: alertsService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlertsComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads alerts and sets loading false', async () => {
      const products = [makeProduct()];
      alertsService.getAlerts.and.resolveTo(products);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.alerts()).toEqual(products);
      expect(component.loading()).toBe(false);
    });

    it('shows error toast when getAlerts fails', async () => {
      alertsService.getAlerts.and.rejectWith(new Error('fail'));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al cargar las alertas',
      );
    });
  });

  describe('triggeredAlerts getter', () => {
    it('returns only products with alert_triggered=true', async () => {
      alertsService.getAlerts.and.resolveTo([
        makeProduct({ id: '1', alert_triggered: true }),
        makeProduct({ id: '2', alert_triggered: false }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.triggeredAlerts.length).toBe(1);
      expect(component.triggeredAlerts[0].id).toBe('1');
    });
  });

  describe('pendingAlerts getter', () => {
    it('returns only products with alert_triggered=false', async () => {
      alertsService.getAlerts.and.resolveTo([
        makeProduct({ id: '1', alert_triggered: true }),
        makeProduct({ id: '2', alert_triggered: false }),
        makeProduct({ id: '3', alert_triggered: false }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.pendingAlerts.length).toBe(2);
    });
  });

  describe('onDelete()', () => {
    beforeEach(() => {
      spyOn(window, 'confirm').and.returnValue(true);
    });

    it('removes alert from list on success', async () => {
      alertsService.getAlerts.and.resolveTo([makeProduct({ id: 'p1' })]);
      alertsService.deleteAlert.and.resolveTo();
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDelete('p1');

      expect(component.alerts().find((a) => a.id === 'p1')).toBeUndefined();
      expect(toastService.success).toHaveBeenCalledWith('Alerta desactivada');
    });

    it('shows error toast when deleteAlert fails', async () => {
      alertsService.getAlerts.and.resolveTo([makeProduct()]);
      alertsService.deleteAlert.and.rejectWith(new Error('fail'));
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDelete('p1');

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al desactivar la alerta',
      );
    });

    it('does nothing when user cancels confirm', async () => {
      (window.confirm as jasmine.Spy).and.returnValue(false);
      alertsService.getAlerts.and.resolveTo([makeProduct()]);
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDelete('p1');

      expect(alertsService.deleteAlert).not.toHaveBeenCalled();
    });
  });

  describe('onReset()', () => {
    it('resets alert_triggered to false in the list', async () => {
      alertsService.getAlerts.and.resolveTo([
        makeProduct({ id: 'p1', alert_triggered: true }),
      ]);
      alertsService.resetAlert.and.resolveTo();
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onReset('p1');

      const updated = component.alerts().find((a) => a.id === 'p1');
      expect(updated?.alert_triggered).toBe(false);
      expect(toastService.success).toHaveBeenCalledWith('Alerta reiniciada');
    });

    it('shows error toast when resetAlert fails', async () => {
      alertsService.getAlerts.and.resolveTo([makeProduct()]);
      alertsService.resetAlert.and.rejectWith(new Error('fail'));
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onReset('p1');

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al reiniciar la alerta',
      );
    });
  });
});
