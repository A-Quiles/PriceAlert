import { TestBed } from '@angular/core/testing';
import { ProfileService } from './profile.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { signal } from '@angular/core';

function makeChain(resolveWith: object) {
  const chain: any = {
    from: jasmine.createSpy('from').and.callFake(() => chain),
    select: jasmine.createSpy('select').and.callFake(() => chain),
    update: jasmine.createSpy('update').and.callFake(() => chain),
    eq: jasmine.createSpy('eq').and.callFake(() => chain),
    single: jasmine.createSpy('single').and.resolveTo(resolveWith),
  };
  return chain;
}

describe('ProfileService', () => {
  let service: ProfileService;
  let mockClient: any;
  const userId = 'user-abc';

  const mockAuthService = {
    user: signal<{ id: string } | null>({ id: userId }),
  };

  beforeEach(() => {
    const chain = makeChain({ data: null, error: null });
    mockClient = { from: jasmine.createSpy('from').and.callFake(() => chain) };

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: SupabaseService, useValue: { client: mockClient } },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(ProfileService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProfile()', () => {
    it('returns null when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      const result = await service.getProfile();
      expect(result).toBeNull();
    });

    it('returns null when supabase returns error', async () => {
      mockAuthService.user = signal({ id: userId });
      const chain = makeChain({ data: null, error: { message: 'not found' } });
      mockClient.from.and.callFake(() => chain);
      const result = await service.getProfile();
      expect(result).toBeNull();
    });

    it('returns profile data on success', async () => {
      mockAuthService.user = signal({ id: userId });
      const profile = {
        id: userId,
        full_name: 'Test User',
        email: 'test@test.com',
      };
      const chain = makeChain({ data: profile, error: null });
      mockClient.from.and.callFake(() => chain);
      const result = await service.getProfile();
      expect(result).toEqual(profile as any);
    });

    it('queries the profiles table', async () => {
      mockAuthService.user = signal({ id: userId });
      const chain = makeChain({ data: {}, error: null });
      mockClient.from.and.callFake(() => chain);
      await service.getProfile();
      expect(mockClient.from).toHaveBeenCalledWith('profiles');
    });
  });

  describe('updateProfile()', () => {
    it('throws when user is not authenticated', async () => {
      mockAuthService.user = signal(null);
      await expectAsync(
        service.updateProfile({ full_name: 'Name' }),
      ).toBeRejectedWithError('Not authenticated');
    });

    it('throws when supabase returns error', async () => {
      mockAuthService.user = signal({ id: userId });
      const chain = makeChain({
        data: null,
        error: { message: 'update failed' },
      });
      mockClient.from.and.callFake(() => chain);
      await expectAsync(
        service.updateProfile({ full_name: 'Name' }),
      ).toBeRejected();
    });

    it('returns updated profile on success', async () => {
      mockAuthService.user = signal({ id: userId });
      const updated = { id: userId, full_name: 'New Name' };
      const chain = makeChain({ data: updated, error: null });
      mockClient.from.and.callFake(() => chain);
      const result = await service.updateProfile({ full_name: 'New Name' });
      expect(result).toEqual(updated as any);
    });
  });
});
