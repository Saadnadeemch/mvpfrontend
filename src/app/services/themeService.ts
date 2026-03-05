import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'buckty_theme';

  isDark = signal<boolean>(this._loadPreference());

  private _loadPreference(): boolean {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved !== null) return saved === 'dark';
      // fallback: system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true; // SSR default
  }

  init(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', this.isDark());
    }
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem(this.STORAGE_KEY, next ? 'dark' : 'light');
    }
  }
}