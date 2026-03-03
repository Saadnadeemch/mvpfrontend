import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environment/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private supabase: SupabaseClient | null = null;
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private zone = inject(NgZone);

  currentUser    = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  isLoading      = signal<boolean>(true);

  private sessionReadyResolver!: () => void;
  private sessionReadyPromise = new Promise<void>((resolve) => {
    this.sessionReadyResolver = resolve;
  });

  constructor(private router: Router) {
    if (!this.isBrowser) {
      this.isLoading.set(false);
      return;
    }

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    this.initializeAuth();
  }

  // ────────────────────────────────
  // INIT
  // ────────────────────────────────
  private async initializeAuth(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data } = await this.supabase.auth.getSession();

      this.zone.run(() => {
        this.currentSession.set(data.session);
        this.currentUser.set(data.session?.user ?? null);
        this.isLoading.set(false);
      });

    } catch (err) {
      console.error('Session restore error:', err);
      this.zone.run(() => this.isLoading.set(false));
    }

    // Resolve waiting callback
    this.sessionReadyResolver();

    // Auth state listener
    this.supabase.auth.onAuthStateChange((event, session) => {
      this.zone.run(() => {
        this.currentSession.set(session);
        this.currentUser.set(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          this.router.navigate(['/login']);
        }
      });
    });
  }

  // 🔥 NEW METHOD
  async waitForSessionReady(): Promise<void> {
    if (!this.isLoading()) return;
    return this.sessionReadyPromise;
  }

  // ────────────────────────────────
  // GOOGLE LOGIN
  // ────────────────────────────────
  async loginWithGoogle(): Promise<void> {
    if (!this.supabase || !this.isBrowser) return;

    this.isLoading.set(true);

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata.readonly',
        ].join(' '),
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });

    if (error) {
      this.zone.run(() => this.isLoading.set(false));
      console.error('Login error:', error.message);
      throw error;
    }
  }

  // ────────────────────────────────
  // LOGOUT
  // ────────────────────────────────
  async logout(): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }

  // ────────────────────────────────
  // HELPERS
  // ────────────────────────────────
  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  isPaid(): boolean {
    if (!this.isBrowser) return false;
    const session = this.currentSession();
    if (!session) return false;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      return payload.is_paid ?? false;
    } catch {
      return false;
    }
  }
}