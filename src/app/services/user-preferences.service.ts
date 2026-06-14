import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const CLOUD_UPLOAD_KEY = 'prefs_cloud_upload';

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  cloudUploadEnabled = signal<boolean>(true);

  constructor() {
    if (this.isBrowser) {
      this.cloudUploadEnabled.set(this.loadFromStorage());
    }

    effect(() => {
      if (!this.isBrowser) return;

      try {
        localStorage.setItem(
          CLOUD_UPLOAD_KEY,
          JSON.stringify(this.cloudUploadEnabled())
        );
      } catch (e) {
        console.error('Failed to save preference:', e);
      }
    });
  }

  private loadFromStorage(): boolean {
    if (!this.isBrowser) return true;

    try {
      const stored = localStorage.getItem(CLOUD_UPLOAD_KEY);
      return stored !== null ? JSON.parse(stored) : true;
    } catch (e) {
      console.error('Failed to load preference:', e);
      return true;
    }
  }
}