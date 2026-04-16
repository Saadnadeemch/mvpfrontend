import { Injectable, signal, effect } from '@angular/core';

const CLOUD_UPLOAD_KEY = 'prefs_cloud_upload';

@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  
  cloudUploadEnabled = signal<boolean>(this.loadFromStorage());

  constructor() {
    effect(() => {
      localStorage.setItem(CLOUD_UPLOAD_KEY, JSON.stringify(this.cloudUploadEnabled()));
    });
  }

  private loadFromStorage(): boolean {
    try {
      const stored = localStorage.getItem(CLOUD_UPLOAD_KEY);
      return stored !== null ? JSON.parse(stored) : true; 
    } catch {
      return true;
    }
  }
}