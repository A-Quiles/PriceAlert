import { Injectable, signal } from '@angular/core';

export type CookieConsentStatus = 'pending' | 'accepted' | 'essential';

const STORAGE_KEY = 'pricealert_cookie_consent';

@Injectable({ providedIn: 'root' })
export class CookieConsentService {
  readonly status = signal<CookieConsentStatus>(this.loadStatus());

  private loadStatus(): CookieConsentStatus {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'accepted' || stored === 'essential') return stored;
    } catch {
      // localStorage not available (e.g. SSR)
    }
    return 'pending';
  }

  acceptAll(): void {
    this.saveAndUpdate('accepted');
  }

  acceptEssential(): void {
    this.saveAndUpdate('essential');
  }

  private saveAndUpdate(status: CookieConsentStatus): void {
    try {
      localStorage.setItem(STORAGE_KEY, status);
    } catch {
      // ignore
    }
    this.status.set(status);
  }
}
