import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard, publicGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

function makeAuthMock(isAuthenticated: boolean, loading = false) {
  return {
    loading: signal(loading),
    isAuthenticated: signal(isAuthenticated),
  };
}

async function runGuard(
  guardFn: typeof authGuard,
  authMock: ReturnType<typeof makeAuthMock>,
): Promise<boolean | UrlTree> {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Router,
        useValue: { createUrlTree: (commands: any[]) => commands },
      },
      { provide: AuthService, useValue: authMock },
    ],
  });
  return TestBed.runInInjectionContext(
    () => (guardFn as any)() as Promise<boolean | UrlTree>,
  );
}

describe('authGuard', () => {
  it('returns true when user is authenticated', async () => {
    const result = await runGuard(authGuard, makeAuthMock(true));
    expect(result).toBe(true);
  });

  it('redirects to /auth/login when not authenticated', async () => {
    const result = await runGuard(authGuard, makeAuthMock(false));
    expect(result).not.toBe(true);
  });

  it('waits for loading to finish before deciding', async () => {
    const auth = makeAuthMock(true, true);
    const promise = runGuard(authGuard, auth);
    // Simulate loading completion after a tick
    setTimeout(() => auth.loading.set(false), 60);
    const result = await promise;
    expect(result).toBe(true);
  });
});

describe('publicGuard', () => {
  it('returns true when user is NOT authenticated', async () => {
    const result = await runGuard(publicGuard, makeAuthMock(false));
    expect(result).toBe(true);
  });

  it('redirects to /dashboard when already authenticated', async () => {
    const result = await runGuard(publicGuard, makeAuthMock(true));
    expect(result).not.toBe(true);
  });

  it('waits for loading to finish before deciding', async () => {
    const auth = makeAuthMock(false, true);
    const promise = runGuard(publicGuard, auth);
    setTimeout(() => auth.loading.set(false), 60);
    const result = await promise;
    expect(result).toBe(true);
  });
});
