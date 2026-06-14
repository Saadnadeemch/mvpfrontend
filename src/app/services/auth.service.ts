import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environment/environment';
import { AuthApi } from './auth.api';
import { SelectPlanPayload, DriveStorage } from './Models/auth.model';
import { getIsPaid, getPlanType, getMembershipType, getIsTrialActive } from './session-token.utils';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase: SupabaseClient | null = null;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private zone = inject(NgZone);
  private router = inject(Router);
  private api = inject(AuthApi);

  currentUser = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  isLoading = signal<boolean>(true);

  private sessionReadyResolve!: (value: boolean) => void;
  private sessionReadyPromise = new Promise<boolean>((res) => {
    this.sessionReadyResolve = res;
  });
  private sessionResolved = false;

  constructor() {
    if (!this.isBrowser) {
      this.isLoading.set(false);
      return;
    }

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    this.isOAuthCallback()
      ? this.handleOAuthCallback()
      : this.handleNormalInit();
  }

  // ================= INIT =================

  private handleOAuthCallback(): void {
    if (!this.supabase) return;

    const timer = setTimeout(() => {
      this.zone.run(() => this.isLoading.set(false));
      this.markSessionReady(false);
    }, 10000);

    const { data: { subscription } } =
      this.supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          clearTimeout(timer);

          this.zone.run(() => {
            this.currentSession.set(session);
            this.currentUser.set(session.user ?? null);
            this.isLoading.set(false);
          });

          await this.api.syncProviderTokens(session);
          await this.refreshSession();

          subscription.unsubscribe();
          this.markSessionReady(true);
        }

        if (event === 'SIGNED_OUT') {
          clearTimeout(timer);
          subscription.unsubscribe();
          this.markSessionReady(false);
        }
      });
  }

private handleNormalInit(): void {
  if (!this.supabase) return;

  // getUser() validates the token with Supabase server and auto-refreshes if expired
  // getSession() just reads localStorage blindly — that's what caused the bug
  this.supabase.auth.getUser().then(async ({ data, error }) => {
    if (error || !data.user) {
      this.zone.run(() => {
        this.currentSession.set(null);
        this.currentUser.set(null);
        this.isLoading.set(false);
      });
      this.markSessionReady(false);
      return;
    }

    // By the time getUser() resolves, the session in localStorage is fresh
    const { data: sessionData } = await this.supabase!.auth.getSession();

    this.zone.run(() => {
      this.currentSession.set(sessionData.session ?? null);
      this.currentUser.set(data.user);
      this.isLoading.set(false);
    });

    this.markSessionReady(true);
  });

  this.supabase.auth.onAuthStateChange((event, session) => {
    this.zone.run(() => {
      this.currentSession.set(session);
      this.currentUser.set(session?.user ?? null);
    });

    if (event === 'SIGNED_OUT') {
      this.router.navigate(['/']);
    }
  });
}
  // ================= SESSION =================

  private markSessionReady(value: boolean) {
    if (this.sessionResolved) return;
    this.sessionResolved = true;
    this.sessionReadyResolve(value);
  }

  waitForSessionReady(): Promise<boolean> {
    return this.sessionReadyPromise;
  }

  async refreshSession(): Promise<void> {
    if (!this.supabase) return;

    const { data } = await this.supabase.auth.refreshSession();

    if (data.session) {
  const session = data.session;

  this.zone.run(() => {
    this.currentSession.set(session);
    this.currentUser.set(session.user);
  });
}
  }

  // ================= AUTH =================

  async loginWithGoogle(): Promise<void> {
    if (!this.supabase || !this.isBrowser) return;

    this.isLoading.set(true);

    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${environment.FrontendURL}/auth/callback`,
        scopes: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/drive.file',
        ].join(' '),
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      this.zone.run(() => this.isLoading.set(false));
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }

  // ================= API =================
async getFreshToken(): Promise<string | null> {
  if (!this.supabase) return null;
  const { data } = await this.supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

  async getProfile() {
    const session = this.currentSession();
    if (!session) return null;
    return this.api.getProfile(session);
  }

  async savePlanSelection(payload: SelectPlanPayload) {
    const session = this.currentSession();
    if (!session) return { error: 'No session' };

    const res = await this.api.savePlanSelection(session, payload);
    await this.refreshSession();
    return res;
  }

  async getDriveStorage(): Promise<DriveStorage> {
    const session = this.currentSession();
    if (!session) return { used_gb: 0, total_gb: 0, percent: 0 };
    return this.api.getDriveStorage(session);
  }

  async getDownloads(): Promise<any[]> {
    if (!this.supabase) return [];

    const user = this.currentUser();
    if (!user) return [];

    return this.api.getDownloads(this.supabase, user.id);
  }

  async hasSelectedPlan(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile?.plan_type != null;
  }

  // ================= TOKEN =================

  isLoggedIn() { return !!this.currentUser(); }
  isPaid() { return this.isBrowser ? getIsPaid(this.currentSession()) : false; }
  getPlanType() { return this.isBrowser ? getPlanType(this.currentSession()) : null; }
  getMembershipType() { return this.isBrowser ? getMembershipType(this.currentSession()) : null; }
  isTrialActive() { return this.isBrowser ? getIsTrialActive(this.currentSession()) : false; }

  getProviderToken(): string | null {
    return this.currentSession()?.provider_token ?? null;
  }

  // ================= UTIL =================

  private isOAuthCallback(): boolean {
    if (!this.isBrowser) return false;
    const { hash, search } = window.location;

    return (
      search.includes('code=') ||
      search.includes('error=') ||
      hash.includes('access_token=') ||
      hash.includes('error=')
    );
  }
}