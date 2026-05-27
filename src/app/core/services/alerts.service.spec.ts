import { TestBed } from '@angular/core/testing';
import { AlertsService } from './alerts.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

/** Crea un builder de Supabase encadenable */
function makeSupabaseChain(
  resolveWith: { data?: any; error?: any; count?: number } = {},
) {
  const chain: any = {
    from: jasmine.createSpy('from').and.callFake(() => chain),
    select: jasmine.createSpy('select').and.callFake(() => chain),
    update: jasmine.createSpy('update').and.callFake(() => chain),
    delete: jasmine.createSpy('delete').and.callFake(() => chain),
    eq: jasmine.createSpy('eq').and.callFake(() => chain),
    order: jasmine.createSpy('order').and.callFake(() => chain),
    limit: jasmine.createSpy('limit').and.callFake(() => chain),
    then: (resolve: Function) =>
      Promise.resolve(resolveWith).then(resolve as any),
  };
  return chain;
}

describe('AlertsService', () => {
  let service: AlertsService;
  let mockClient: any;
  let mockChain: any;
  const userId = 'user-123';

  const mockAuthService = {
    user: signal<{ id: string } | null>({ id: userId }),
  };

  beforeEach(() => {
    // Reset auth state before every test
    mockAuthService.user = signal({ id: userId });

    mockChain = makeSupabaseChain({ data: [], error: null });
    mockClient = {
      from: jasmine.createSpy('from').and.callFake(() => mockChain),
    };
    mockChain.from = mockClient.from;

    TestBed.configureTestingModule({
      providers: [
        AlertsService,
        { provide: SupabaseService, useValue: { client: mockClient } },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(AlertsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getAlerts()', () => {
    it('returns empty array when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      const result = await service.getAlerts();
      expect(result).toEqual([]);
    });

    it('queries tracked_products with alert_enabled=true', async () => {
      mockChain = {
        ...makeSupabaseChain({
          data: [{ id: '1', alert_enabled: true }],
          error: null,
        }),
      };
      mockClient.from.and.callFake(() => mockChain);
      const result = await service.getAlerts();
      expect(mockClient.from).toHaveBeenCalledWith('tracked_products');
    });

    it('throws when supabase returns error', async () => {
      mockAuthService.user = signal({ id: userId });
      mockChain = makeSupabaseChain({
        data: null,
        error: { message: 'db error' },
      });
      mockClient.from.and.callFake(() => mockChain);
      await expectAsync(service.getAlerts()).toBeRejected();
    });
  });

  describe('deleteAlert()', () => {
    it('throws when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      await expectAsync(service.deleteAlert('alert-1')).toBeRejectedWithError(
        'Not authenticated',
      );
    });

    it('calls update on tracked_products with alert_enabled=false', async () => {
      mockAuthService.user = signal({ id: userId });
      mockChain = makeSupabaseChain({ error: null });
      mockClient.from.and.callFake(() => mockChain);
      await service.deleteAlert('alert-1');
      expect(mockClient.from).toHaveBeenCalledWith('tracked_products');
    });
  });

  describe('resetAlert()', () => {
    it('throws when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      await expectAsync(service.resetAlert('alert-1')).toBeRejectedWithError(
        'Not authenticated',
      );
    });

    it('calls update with reset fields', async () => {
      mockAuthService.user = signal({ id: userId });
      mockChain = makeSupabaseChain({ error: null });
      mockClient.from.and.callFake(() => mockChain);
      await service.resetAlert('alert-1');
      expect(mockClient.from).toHaveBeenCalledWith('tracked_products');
    });
  });

  describe('getTriggeredAlertsCount()', () => {
    it('returns 0 when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      const result = await service.getTriggeredAlertsCount();
      expect(result).toBe(0);
    });

    it('returns the count from supabase', async () => {
      mockAuthService.user = signal({ id: userId });
      mockChain = makeSupabaseChain({ count: 3, error: null });
      mockClient.from.and.callFake(() => mockChain);
      const result = await service.getTriggeredAlertsCount();
      expect(result).toBe(3);
    });

    it('returns 0 when count is null', async () => {
      mockAuthService.user = signal({ id: userId });
      mockChain = makeSupabaseChain({ count: undefined, error: null });
      mockClient.from.and.callFake(() => mockChain);
      const result = await service.getTriggeredAlertsCount();
      expect(result).toBe(0);
    });
  });
});
