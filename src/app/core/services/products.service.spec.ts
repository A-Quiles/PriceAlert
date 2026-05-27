import { TestBed } from '@angular/core/testing';
import { ProductsService } from './products.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { LoggerService } from './logger.service';
import { signal } from '@angular/core';

const userId = 'user-xyz';

/** Mock del LoggerService sin efectos secundarios */
const loggerMock = {
  debug: jasmine.createSpy('debug'),
  info: jasmine.createSpy('info'),
  warn: jasmine.createSpy('warn'),
  error: jasmine.createSpy('error'),
  supabaseError: jasmine.createSpy('supabaseError'),
  fetchError: jasmine.createSpy('fetchError'),
};

/** Construye un builder Supabase encadenable con promesa configurable */
function makeChain(result: object): any {
  const chain: any = {
    select: jasmine.createSpy('select').and.callFake(() => chain),
    insert: jasmine.createSpy('insert').and.callFake(() => chain),
    update: jasmine.createSpy('update').and.callFake(() => chain),
    delete: jasmine.createSpy('delete').and.callFake(() => chain),
    upsert: jasmine.createSpy('upsert').and.callFake(() => chain),
    eq: jasmine.createSpy('eq').and.callFake(() => chain),
    neq: jasmine.createSpy('neq').and.callFake(() => chain),
    not: jasmine.createSpy('not').and.callFake(() => chain),
    order: jasmine.createSpy('order').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake(() => chain),
    gte: jasmine.createSpy('gte').and.callFake(() => chain),
    or: jasmine.createSpy('or').and.callFake(() => chain),
    single: jasmine.createSpy('single').and.resolveTo(result),
    then: (_resolve: Function, _reject: Function) =>
      Promise.resolve(result).then(_resolve as any, _reject as any),
  };
  return chain;
}

describe('ProductsService', () => {
  let service: ProductsService;
  let mockClient: { from: jasmine.Spy };

  const mockAuth = {
    user: signal<{ id: string } | null>({ id: userId }),
  };

  function setupClient(
    defaultResult: object = { data: [], error: null, count: 0 },
  ) {
    const chain = makeChain(defaultResult);
    mockClient = { from: jasmine.createSpy('from').and.callFake(() => chain) };
    TestBed.overrideProvider(SupabaseService, {
      useValue: { client: mockClient },
    });
    service = TestBed.inject(ProductsService);
    return chain;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProductsService,
        {
          provide: SupabaseService,
          useValue: { client: { from: jasmine.createSpy() } },
        },
        { provide: AuthService, useValue: mockAuth },
        { provide: LoggerService, useValue: loggerMock },
      ],
    });
    // reset spies
    Object.values(loggerMock).forEach((s: any) => s.calls?.reset());
    mockAuth.user = signal({ id: userId });
  });

  it('should be created', () => {
    service = TestBed.inject(ProductsService);
    expect(service).toBeTruthy();
  });

  // ─── getProducts ──────────────────────────────────────────────────────────

  describe('getProducts()', () => {
    it('returns empty array when user not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      const result = await service.getProducts();
      expect(result).toEqual([]);
    });

    it('returns products from supabase', async () => {
      const products = [{ id: '1', title: 'Test' }];
      setupClient({ data: products, error: null });
      const result = await service.getProducts();
      expect(result).toEqual(products as any);
    });

    it('throws on supabase error', async () => {
      setupClient({ data: null, error: { message: 'fail' } });
      await expectAsync(service.getProducts()).toBeRejected();
    });
  });

  // ─── getProductById ───────────────────────────────────────────────────────

  describe('getProductById()', () => {
    it('returns null when user not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      expect(await service.getProductById('1')).toBeNull();
    });

    it('returns null when supabase returns error', async () => {
      const chain = makeChain({ data: null, error: { message: 'not found' } });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);
      expect(await service.getProductById('1')).toBeNull();
    });
  });

  // ─── addProduct (límite de 10) ────────────────────────────────────────────

  describe('addProduct() — límite de 10 productos', () => {
    it('throws when user has 10 or more products', async () => {
      const chain = makeChain({ count: 10, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      await expectAsync(
        service.addProduct({ url: 'https://amazon.es/dp/B001' }),
      ).toBeRejectedWithError(/L\u00edmite de 10 productos/);
    });

    it('throws when user is not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      await expectAsync(
        service.addProduct({ url: 'https://amazon.es/dp/B001' }),
      ).toBeRejectedWithError('Not authenticated');
    });

    it('throws network error when scraper is unreachable', async () => {
      const chain = makeChain({ count: 0, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      spyOn(window, 'fetch').and.rejectWith(new TypeError('Failed to fetch'));

      await expectAsync(
        service.addProduct({ url: 'https://amazon.es/dp/B001' }),
      ).toBeRejected();
    });

    it('throws when scraper returns non-ok status', async () => {
      const chain = makeChain({ count: 2, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      spyOn(window, 'fetch').and.resolveTo(
        new Response(JSON.stringify({ message: 'Scrape failed' }), {
          status: 500,
        }),
      );

      await expectAsync(
        service.addProduct({ url: 'https://amazon.es/dp/B001' }),
      ).toBeRejected();
    });
  });

  // ─── updateProduct ────────────────────────────────────────────────────────

  describe('updateProduct()', () => {
    it('throws when user not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      await expectAsync(service.updateProduct('1', {})).toBeRejectedWithError(
        'Not authenticated',
      );
    });

    it('returns updated product on success', async () => {
      const updated = { id: '1', title: 'Updated' };
      const chain = makeChain({ data: updated, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);
      const result = await service.updateProduct('1', { alert_enabled: false });
      expect(result).toEqual(updated as any);
    });

    it('throws on supabase error', async () => {
      const chain = makeChain({ data: null, error: { message: 'fail' } });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);
      await expectAsync(service.updateProduct('1', {})).toBeRejected();
    });
  });

  // ─── deleteProduct ────────────────────────────────────────────────────────

  describe('deleteProduct()', () => {
    it('throws when user not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      await expectAsync(service.deleteProduct('1')).toBeRejectedWithError(
        'Not authenticated',
      );
    });

    it('resolves on success', async () => {
      const chain = makeChain({ error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);
      await expectAsync(service.deleteProduct('1')).toBeResolved();
    });

    it('throws when supabase returns error', async () => {
      const chain = makeChain({ error: { message: 'fail' } });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);
      await expectAsync(service.deleteProduct('1')).toBeRejected();
    });
  });

  // ─── getDashboardStats ────────────────────────────────────────────────────

  describe('getDashboardStats()', () => {
    it('returns zeros when user not authenticated', async () => {
      mockAuth.user = signal(null);
      service = TestBed.inject(ProductsService);
      const stats = await service.getDashboardStats();
      expect(stats).toEqual({
        totalProducts: 0,
        activeAlerts: 0,
        triggeredAlerts: 0,
        avgSavings: 0,
      });
    });

    it('counts products, active and triggered alerts', async () => {
      const products = [
        {
          alert_enabled: true,
          alert_triggered: true,
          current_price: 80,
          original_price: 100,
        },
        {
          alert_enabled: true,
          alert_triggered: false,
          current_price: 50,
          original_price: null,
        },
        {
          alert_enabled: false,
          alert_triggered: false,
          current_price: 200,
          original_price: 250,
        },
      ];
      const chain = makeChain({ data: products, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      const stats = await service.getDashboardStats();
      expect(stats.totalProducts).toBe(3);
      expect(stats.activeAlerts).toBe(2);
      expect(stats.triggeredAlerts).toBe(1);
    });

    it('calculates average savings correctly', async () => {
      const products = [
        {
          alert_enabled: false,
          alert_triggered: false,
          current_price: 80,
          original_price: 100,
        },
        {
          alert_enabled: false,
          alert_triggered: false,
          current_price: 60,
          original_price: 100,
        },
      ];
      const chain = makeChain({ data: products, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      const stats = await service.getDashboardStats();
      // savings: [20, 40] → avg = 30
      expect(stats.avgSavings).toBe(30);
    });

    it('returns avgSavings 0 when no products have both prices', async () => {
      const products = [
        {
          alert_enabled: true,
          alert_triggered: false,
          current_price: null,
          original_price: null,
        },
      ];
      const chain = makeChain({ data: products, error: null });
      mockClient = {
        from: jasmine.createSpy('from').and.callFake(() => chain),
      };
      TestBed.overrideProvider(SupabaseService, {
        useValue: { client: mockClient },
      });
      service = TestBed.inject(ProductsService);

      const stats = await service.getDashboardStats();
      expect(stats.avgSavings).toBe(0);
    });
  });
});
