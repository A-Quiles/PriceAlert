import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'pricealert-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal(false);

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEY);
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;
    this.applyTheme(stored ? stored === 'dark' : prefersDark);
  }

  toggle(): void {
    this.applyTheme(!this.isDark());
  }

  private applyTheme(dark: boolean): void {
    // Activa la transición solo durante el cambio de tema
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    root.classList.toggle('dark', dark);
    this.isDark.set(dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    setTimeout(() => root.classList.remove('theme-transitioning'), 400);
  }
}
