import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ProductsService } from '../../../core/services/products.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-add-product',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './add-product.component.html',
})
export class AddProductComponent {
  private readonly productsService = inject(ProductsService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly step = signal<'url' | 'confirm'>('url');
  previewData: any = null;

  form = this.fb.group({
    url: [
      '',
      [
        Validators.required,
        Validators.pattern(/amazon\.(es|com|co\.uk|de|fr|it|nl|pl|se)/),
      ],
    ],
    alertThreshold: [null as number | null],
    alertEnabled: [true],
  });

  get urlError(): string | null {
    const ctrl = this.form.get('url');
    if (!ctrl?.invalid || !ctrl?.touched) return null;
    if (ctrl.errors?.['required']) return 'La URL es obligatoria';
    if (ctrl.errors?.['pattern'])
      return 'Introduce una URL válida de Amazon (amazon.es, amazon.com, etc.)';
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);

    try {
      const { url, alertThreshold, alertEnabled } = this.form.value;
      const product = await this.productsService.addProduct({
        url: url ?? '',
        alert_threshold: alertThreshold,
        alert_enabled: alertEnabled ?? true,
      });

      this.toast.success(
        `"${product.title.substring(0, 40)}..." añadido correctamente`,
      );
      this.router.navigate(['/products', product.id]);
    } catch (e: any) {
      this.toast.error(
        e.message ?? 'Error al añadir el producto. Verifica la URL.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  pasteFromClipboard(): void {
    navigator.clipboard
      .readText()
      .then((text) => {
        this.form.patchValue({ url: text.trim() });
        this.form.get('url')?.markAsTouched();
      })
      .catch(() => {
        this.toast.warning('No se pudo leer el portapapeles');
      });
  }
}
