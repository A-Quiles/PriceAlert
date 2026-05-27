import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';
import { ProductsService } from '../../core/services/products.service';
import { AlertsService } from '../../core/services/alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { RouterTestingModule } from '@angular/router/testing';
import { signal } from '@angular/core';
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

const defaultStats = {
  totalProducts: 3,
  activeAlerts: 2,
  triggeredAlerts: 1,
  avgSavings: 15,
};

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let productsService: jasmine.SpyObj<ProductsService>;
  let alertsService: jasmine.SpyObj<AlertsService>;
  let toastService: jasmine.SpyObj<ToastService>;
  const authMock = {
    user: signal<any>({
      email: 'test@example.com',
      user_metadata: { full_name: 'John Doe' },
    }),
  };

  beforeEach(async () => {
    productsService = jasmine.createSpyObj('ProductsService', [
      'getProducts',
      'getDashboardStats',
      'refreshProduct',
      'deleteProduct',
      'updateProduct',
    ]);
    alertsService = jasmine.createSpyObj('AlertsService', [
      'getTriggeredAlertsCount',
    ]);
    toastService = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'info',
    ]);

    productsService.getProducts.and.resolveTo([]);
    productsService.getDashboardStats.and.resolveTo(defaultStats);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent, RouterTestingModule],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: AlertsService, useValue: alertsService },
        { provide: AuthService, useValue: authMock },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads products and stats, then sets loading to false', async () => {
      const products = [makeProduct({ id: '1' }), makeProduct({ id: '2' })];
      productsService.getProducts.and.resolveTo(products);
      productsService.getDashboardStats.and.resolveTo(defaultStats);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.loading()).toBe(false);
      expect(component.stats()).toEqual(defaultStats);
    });

    it('shows only first 6 products on dashboard', async () => {
      const products = Array.from({ length: 10 }, (_, i) =>
        makeProduct({ id: `p${i}` }),
      );
      productsService.getProducts.and.resolveTo(products);
      productsService.getDashboardStats.and.resolveTo(defaultStats);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.products().length).toBe(6);
    });

    it('shows error toast when getProducts fails', async () => {
      productsService.getProducts.and.rejectWith(new Error('fail'));

      fixture.detectChanges();
      await fixture.whenStable();

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al cargar los productos',
      );
    });
  });

  describe('userName getter', () => {
    it('returns full_name from user metadata', () => {
      authMock.user.set({
        user_metadata: { full_name: 'John Doe' },
        email: 'john@example.com',
      });
      expect(component.userName).toBe('John Doe');
    });

    it('falls back to email prefix when full_name is absent', () => {
      authMock.user.set({ user_metadata: {}, email: 'alice@example.com' });
      expect(component.userName).toBe('alice');
    });

    it('returns "Usuario" when user is null', () => {
      authMock.user.set(null);
      expect(component.userName).toBe('Usuario');
    });
  });

  describe('onRefreshProduct()', () => {
    it('updates product in the list on success', async () => {
      const original = makeProduct({ id: '1', current_price: 100 });
      const updated = makeProduct({ id: '1', current_price: 75 });
      productsService.getProducts.and.resolveTo([original]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);
      productsService.refreshProduct.and.resolveTo(updated);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onRefreshProduct('1');

      expect(component.products()[0].current_price).toBe(75);
      expect(toastService.success).toHaveBeenCalledWith(
        'Precio actualizado correctamente',
      );
    });

    it('shows error toast when refreshProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);
      productsService.refreshProduct.and.rejectWith(new Error('Scraper error'));

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onRefreshProduct('1');

      expect(toastService.error).toHaveBeenCalledWith('Scraper error');
    });
  });

  describe('onDeleteProduct()', () => {
    beforeEach(() => {
      spyOn(window, 'confirm').and.returnValue(true);
    });

    it('removes product and decrements stat counter', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.getDashboardStats.and.resolveTo({
        ...defaultStats,
        totalProducts: 1,
      });
      productsService.deleteProduct.and.resolveTo();

      fixture.detectChanges();
      await fixture.whenStable();

      const before = component.stats().totalProducts;
      await component.onDeleteProduct('1');

      expect(component.products()).toEqual([]);
      expect(component.stats().totalProducts).toBe(before - 1);
      expect(toastService.success).toHaveBeenCalledWith('Producto eliminado');
    });

    it('shows error toast when deleteProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);
      productsService.deleteProduct.and.rejectWith(new Error('fail'));

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDeleteProduct('1');

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al eliminar el producto',
      );
    });

    it('does nothing when user cancels confirm', async () => {
      (window.confirm as jasmine.Spy).and.returnValue(false);
      productsService.getProducts.and.resolveTo([makeProduct()]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDeleteProduct('1');

      expect(productsService.deleteProduct).not.toHaveBeenCalled();
    });
  });

  describe('onToggleAlert()', () => {
    it('updates alert_enabled in list on success', async () => {
      productsService.getProducts.and.resolveTo([
        makeProduct({ id: '1', alert_enabled: true }),
      ]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);
      productsService.updateProduct.and.resolveTo(
        makeProduct({ id: '1', alert_enabled: false }),
      );

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onToggleAlert({ id: '1', enabled: false });

      expect(component.products()[0].alert_enabled).toBe(false);
    });

    it('shows error toast when updateProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.getDashboardStats.and.resolveTo(defaultStats);
      productsService.updateProduct.and.rejectWith(new Error('fail'));

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onToggleAlert({ id: '1', enabled: false });

      expect(toastService.error).toHaveBeenCalledWith(
        'Error al actualizar la alerta',
      );
    });
  });
});
