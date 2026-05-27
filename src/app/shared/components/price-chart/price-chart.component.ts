import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PriceHistory, PriceChartData } from '../../../core/models';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Filler,
  ChartOptions,
  ChartData,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  CategoryScale,
  Tooltip,
  Filler,
);

@Component({
  selector: 'app-price-chart',
  standalone: true,
  template: `
    <div class="relative">
      <canvas #chartCanvas class="w-full"></canvas>
      @if (!hasData) {
        <div
          class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm"
        >
          Sin historial de precios aún
        </div>
      }
    </div>
  `,
})
export class PriceChartComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() history: PriceHistory[] = [];
  @Input() currency = 'EUR';
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private readonly platformId = inject(PLATFORM_ID);

  hasData = false;

  ngOnInit(): void {
    this.hasData = this.history.length > 0;
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId) && this.hasData) {
      this.buildChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  get chartData(): PriceChartData {
    const sorted = [...this.history].sort(
      (a, b) =>
        new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    const labels = sorted.map((h) =>
      new Date(h.recorded_at).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
      }),
    );
    const prices = sorted.map((h) => h.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const currentPrice = prices[prices.length - 1] ?? 0;
    const firstPrice = prices[0] ?? currentPrice;
    const priceChange = currentPrice - firstPrice;
    const priceChangePercent =
      firstPrice > 0 ? (priceChange / firstPrice) * 100 : 0;
    return {
      labels,
      prices,
      minPrice,
      maxPrice,
      currentPrice,
      priceChange,
      priceChangePercent,
    };
  }

  private buildChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const { labels, prices } = this.chartData;

    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.2)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    const data: ChartData<'line'> = {
      labels,
      datasets: [
        {
          label: `Precio (${this.currency})`,
          data: prices,
          borderColor: '#2563eb',
          backgroundColor: gradient,
          borderWidth: 2,
          pointRadius: prices.length <= 10 ? 4 : 2,
          pointBackgroundColor: '#2563eb',
          fill: true,
          tension: 0.4,
        },
      ],
    };

    const options: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${(ctx.parsed.y ?? 0).toFixed(2)} ${this.currency}`,
          },
        },
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `${Number(value).toFixed(0)} ${this.currency}`,
          },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
      },
    };

    this.chart = new Chart(ctx, { type: 'line', data, options });
  }
}
