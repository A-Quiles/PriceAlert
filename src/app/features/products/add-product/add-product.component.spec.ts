import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddProductComponent } from './add-product.component';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

describe('AddProductComponent', () => {
  let component: AddProductComponent;
  let fixture: ComponentFixture<AddProductComponent>;
  let productsService: jasmine.SpyObj<ProductsService>;
  let toastService: jasmine.SpyObj<ToastService>;
  let router: Router;

  beforeEach(async () => {
    productsService = jasmine.createSpyObj('ProductsService', ['addProduct']);
    toastService = jasmine.createSpyObj('ToastService', [
      'success',
      'error',
      'warning',
    ]);

    await TestBed.configureTestingModule({
      imports: [AddProductComponent, RouterTestingModule],
      providers: [
        { provide: ProductsService, useValue: productsService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddProductComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  describe('form validation', () => {
    it('starts with invalid form (empty url)', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('urlError returns null when field not touched', () => {
      expect(component.urlError).toBeNull();
    });

    it('urlError returns required message when touched and empty', () => {
      component.form.get('url')!.markAsTouched();
      expect(component.urlError).toBe('La URL es obligatoria');
    });

    it('urlError returns pattern message for non-amazon url', () => {
      component.form.patchValue({ url: 'https://google.com' });
      component.form.get('url')!.markAsTouched();
      expect(component.urlError).toContain('URL válida de Amazon');
    });

    it('form is valid with a correct amazon url', () => {
      component.form.patchValue({ url: 'https://www.amazon.es/dp/B001TEST' });
      expect(component.form.get('url')!.valid).toBe(true);
    });

    it('accepts amazon.com domain', () => {
      component.form.patchValue({ url: 'https://www.amazon.com/dp/B001TEST' });
      expect(component.form.get('url')!.valid).toBe(true);
    });
  });

  describe('onSubmit()', () => {
    const validUrl = 'https://www.amazon.es/dp/B001TEST';
    const fakeProduct = {
      id: 'p1',
      title: 'Producto de prueba que tiene un titulo bastante largo',
    } as any;

    it('does nothing when form is invalid', async () => {
      await component.onSubmit();
      expect(productsService.addProduct).not.toHaveBeenCalled();
    });

    it('does nothing when already loading', async () => {
      component.form.patchValue({ url: validUrl });
      component.loading.set(true);
      await component.onSubmit();
      expect(productsService.addProduct).not.toHaveBeenCalled();
    });

    it('calls addProduct with correct DTO', async () => {
      component.form.patchValue({
        url: validUrl,
        alertThreshold: 50,
        alertEnabled: true,
      });
      productsService.addProduct.and.resolveTo(fakeProduct);

      await component.onSubmit();

      expect(productsService.addProduct).toHaveBeenCalledWith({
        url: validUrl,
        alert_threshold: 50,
        alert_enabled: true,
      });
    });

    it('navigates to product detail page on success', async () => {
      component.form.patchValue({ url: validUrl });
      productsService.addProduct.and.resolveTo(fakeProduct);

      await component.onSubmit();

      expect(router.navigate).toHaveBeenCalledWith(['/products', 'p1']);
    });

    it('shows success toast with truncated title', async () => {
      component.form.patchValue({ url: validUrl });
      productsService.addProduct.and.resolveTo(fakeProduct);

      await component.onSubmit();

      expect(toastService.success).toHaveBeenCalled();
    });

    it('shows error toast when addProduct fails', async () => {
      component.form.patchValue({ url: validUrl });
      productsService.addProduct.and.rejectWith(new Error('Límite alcanzado'));

      await component.onSubmit();

      expect(toastService.error).toHaveBeenCalledWith('Límite alcanzado');
    });

    it('resets loading to false after success', async () => {
      component.form.patchValue({ url: validUrl });
      productsService.addProduct.and.resolveTo(fakeProduct);

      await component.onSubmit();

      expect(component.loading()).toBe(false);
    });

    it('resets loading to false after failure', async () => {
      component.form.patchValue({ url: validUrl });
      productsService.addProduct.and.rejectWith(new Error('fail'));

      await component.onSubmit();

      expect(component.loading()).toBe(false);
    });
  });

  describe('pasteFromClipboard()', () => {
    it('patches url field from clipboard', async () => {
      const readSpy = spyOn(navigator.clipboard, 'readText').and.resolveTo(
        '  https://www.amazon.es/dp/B001  ',
      );
      component.pasteFromClipboard();
      await readSpy.calls.mostRecent().returnValue;
      expect(component.form.value.url).toBe('https://www.amazon.es/dp/B001');
    });

    it('shows warning when clipboard read fails', async () => {
      const rejected = Promise.reject(new Error('denied'));
      spyOn(navigator.clipboard, 'readText').and.returnValue(rejected);
      component.pasteFromClipboard();
      // Allow the rejected promise chain (.catch) to settle
      await rejected.catch(() => {});
      expect(toastService.warning).toHaveBeenCalledWith(
        'No se pudo leer el portapapeles',
      );
    });
  });
});
