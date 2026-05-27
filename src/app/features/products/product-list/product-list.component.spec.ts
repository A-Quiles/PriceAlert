import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListComponent } from './product-list.component';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { RouterTestingModule } from '@angular/router/testing';
import { Product } from '../../../core/models';

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

describe('ProductListComponent', () => {
  let component: ProductListComponent;
  let fixture: ComponentFixture<ProductListComponent>;
  let productsService: jasmine.SpyObj<ProductsService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    productsService = jasmine.createSpyObj('ProductsService', [
      'getProducts',
      'refreshProduct',
      'deleteProduct',
      'updateProduct',
    ]);
    toastService = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'info',
      'warning',
    ]);
    productsService.getProducts.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [ProductListComponent, RouterTestingModule],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductListComponent);
    component = fixture.componentInstance;
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('loads products and sets loading false', async () => {
      const products = [makeProduct({ id: '1' }), makeProduct({ id: '2' })];
      productsService.getProducts.and.resolveTo(products);

      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.allProducts()).toEqual(products);
      expect(component.loading()).toBe(false);
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

  describe('filteredProducts getter', () => {
    beforeEach(async () => {
      productsService.getProducts.and.resolveTo([
        makeProduct({ id: '1', title: 'Apple iPhone 15', asin: 'B001' }),
        makeProduct({ id: '2', title: 'Samsung TV', asin: 'B002' }),
      ]);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('returns all products when searchQuery is empty', () => {
      component.searchQuery = '';
      expect(component.filteredProducts.length).toBe(2);
    });

    it('filters products by title (case-insensitive)', () => {
      component.searchQuery = 'apple';
      expect(component.filteredProducts.length).toBe(1);
      expect(component.filteredProducts[0].id).toBe('1');
    });

    it('filters products by asin', () => {
      component.searchQuery = 'B002';
      expect(component.filteredProducts.length).toBe(1);
      expect(component.filteredProducts[0].id).toBe('2');
    });

    it('returns empty array when no match', () => {
      component.searchQuery = 'Nexus';
      expect(component.filteredProducts).toEqual([]);
    });
  });

  describe('onRefreshProduct()', () => {
    it('updates product in the list on success', async () => {
      const original = makeProduct({ id: '1', current_price: 100 });
      const updated = makeProduct({ id: '1', current_price: 80 });
      productsService.getProducts.and.resolveTo([original]);
      productsService.refreshProduct.and.resolveTo(updated);

      fixture.detectChanges();
      await fixture.whenStable();

      await component.onRefreshProduct('1');

      expect(component.allProducts()[0].current_price).toBe(80);
      expect(toastService.success).toHaveBeenCalledWith('Precio actualizado');
    });

    it('shows error toast when refreshProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
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

    it('removes product from list on success', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.deleteProduct.and.resolveTo();
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDeleteProduct('1');

      expect(component.allProducts()).toEqual([]);
      expect(toastService.success).toHaveBeenCalledWith('Producto eliminado');
    });

    it('shows error toast when deleteProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
      productsService.deleteProduct.and.rejectWith(new Error('fail'));
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDeleteProduct('1');

      expect(toastService.error).toHaveBeenCalledWith('Error al eliminar');
    });

    it('does nothing when user cancels confirm', async () => {
      (window.confirm as jasmine.Spy).and.returnValue(false);
      productsService.getProducts.and.resolveTo([makeProduct()]);
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onDeleteProduct('1');

      expect(productsService.deleteProduct).not.toHaveBeenCalled();
    });
  });

  describe('onToggleAlert()', () => {
    it('updates alert_enabled in the list on success', async () => {
      productsService.getProducts.and.resolveTo([
        makeProduct({ id: '1', alert_enabled: true }),
      ]);
      productsService.updateProduct.and.resolveTo(
        makeProduct({ id: '1', alert_enabled: false }),
      );
      fixture.detectChanges();
      await fixture.whenStable();

      await component.onToggleAlert({ id: '1', enabled: false });

      expect(component.allProducts()[0].alert_enabled).toBe(false);
    });

    it('shows error toast when updateProduct fails', async () => {
      productsService.getProducts.and.resolveTo([makeProduct({ id: '1' })]);
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
