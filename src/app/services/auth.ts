import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environment/environment';

export interface UserProfile {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  is_paid?: boolean;
  plan_type?: 'basic' | 'advanced' | null;
  membership_type?: 'monthly' | 'yearly' | null;
  membership_start?: string;
  membership_end?: string;
  next_billing_date?: string;
  is_trial?: boolean;
  trial_start?: string;
  trial_end?: string;
  payment_customer_id?: string;
  payment_subscription_id?: string;
  payment_provider?: string;
  payment_price_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SelectPlanPayload {
  plan_type: 'basic' | 'advanced';
  isAnnual: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase: SupabaseClient | null = null;
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private zone = inject(NgZone);
  private http = inject(HttpClient);

  currentUser = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  isLoading = signal<boolean>(true);

  private _sessionReadyResolve!: (v: boolean) => void;
  private _sessionReadyPromise = new Promise<boolean>((res) => {
    this._sessionReadyResolve = res;
  });
  private _sessionResolved = false;

  private resolveSession(value: boolean): void {
    if (this._sessionResolved) return;
    this._sessionResolved = true;
    this._sessionReadyResolve(value);
  }

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

  private initializeAuth(): void {
    if (!this.supabase) return;

    if (this.isOAuthCallbackUrl()) {
      const timer = setTimeout(() => {
        this.zone.run(() => this.isLoading.set(false));
        this.resolveSession(false);
      }, 10000);

      const { data: { subscription } } =
        this.supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            clearTimeout(timer);

            // Set the initial session so authHeaders() works for /api/auth/sync
            this.zone.run(() => {
              this.currentSession.set(session);
              this.currentUser.set(session.user ?? null);
              this.isLoading.set(false);
            });

            // Unsubscribe AFTER sync+refresh so TOKEN_REFRESHED doesn't re-trigger this block
            await this.syncAndRefresh(session);

            subscription.unsubscribe();
            this.resolveSession(true);
          }

          if (event === 'SIGNED_OUT') {
            clearTimeout(timer);
            subscription.unsubscribe();
            this.zone.run(() => this.isLoading.set(false));
            this.resolveSession(false);
          }
        });
    } else {
      this.supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('[Auth] getSession error:', error.message);
        }

        this.zone.run(() => {
          this.currentSession.set(data?.session ?? null);
          this.currentUser.set(data?.session?.user ?? null);
          this.isLoading.set(false);
        });

        this.resolveSession(!!data?.session);
      });

      this.supabase.auth.onAuthStateChange((event, session) => {
        this.zone.run(() => {
          this.currentSession.set(session);
          this.currentUser.set(session?.user ?? null);
        });

        if (event === 'SIGNED_OUT') {
          this.router.navigate(['/login']);
        }
      });
    }
  }

  // Calls backend sync then immediately refreshes the JWT so custom
  // claims (is_paid, trial_end, plan_type) are baked into the token in memory.
  private async syncAndRefresh(session: Session): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/api/auth/sync`,
          {},
          { headers: this.authHeaders(session) }
        )
      );
    } catch (err) {
      console.error('[Auth] sync error:', err);
      // Don't block the flow — user can still proceed, JWT just won't have custom claims
    }

    // Always attempt refresh even if sync failed, to get the freshest token
    await this.refreshSession();
  }

  // Refreshes the Supabase session and updates signals.
  // Call this any time you write to user_metadata on the backend
  // (after sync, after plan selection) so in-memory JWT stays current.
  async refreshSession(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        console.error('[Auth] refreshSession error:', error.message);
        return;
      }

      if (data.session) {
        this.zone.run(() => {
          this.currentSession.set(data.session!);
          this.currentUser.set(data.session!.user);
        });
      }
    } catch (err) {
      console.error('[Auth] refreshSession unexpected error:', err);
    }
  }

  private isOAuthCallbackUrl(): boolean {
    if (!this.isBrowser) return false;
    const { hash, search } = window.location;
    return (
      search.includes('code=') ||
      search.includes('error=') ||
      hash.includes('access_token=') ||
      hash.includes('error=')
    );
  }

  private authHeaders(session?: Session): HttpHeaders {
    const token = session?.access_token ?? this.currentSession()?.access_token;

    if (!token) {
      throw new Error('No auth token available');
    }

    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  waitForSessionReady(): Promise<boolean> {
    return this._sessionReadyPromise;
  }

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
        ].join(' '),
        queryParams: { access_type: 'offline', prompt: 'consent' },
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

  async getProfile(): Promise<UserProfile | null> {
    try {
      const session = this.currentSession();
      if (!session) return null;

      return await firstValueFrom(
        this.http.get<UserProfile>(
          `${environment.apiUrl}/api/user/profile`,
          { headers: this.authHeaders(session) }
        )
      );
    } catch (err) {
      console.error('[Auth] getProfile error:', err);
      return null;
    }
  }

  async savePlanSelection(
    payload: SelectPlanPayload
  ): Promise<{ error: string | null }> {
    try {
      const session = this.currentSession();
      if (!session) return { error: 'No session' };

      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/api/user/plan`,
          payload,
          { headers: this.authHeaders(session) }
        )
      );

      // Refresh JWT so plan_type and membership_type are now in the token
      await this.refreshSession();

      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to save plan' };
    }
  }

  async hasSelectedPlan(): Promise<boolean> {
    const profile = await this.getProfile();
    return profile?.plan_type != null;
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  isPaid(): boolean {
    if (!this.isBrowser) return false;
    const session = this.currentSession();
    if (!session) return false;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      return payload.user_metadata?.is_paid ?? false;
    } catch {
      return false;
    }
  }

  getPlanType(): 'basic' | 'advanced' | null {
    if (!this.isBrowser) return null;
    const session = this.currentSession();
    if (!session) return null;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      return payload.user_metadata?.plan_type ?? null;
    } catch {
      return null;
    }
  }

  getMembershipType(): 'monthly' | 'yearly' | null {
    if (!this.isBrowser) return null;
    const session = this.currentSession();
    if (!session) return null;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      return payload.user_metadata?.membership_type ?? null;
    } catch {
      return null;
    }
  }

  isTrialActive(): boolean {
    if (!this.isBrowser) return false;
    const session = this.currentSession();
    if (!session) return false;

    try {
      const payload = JSON.parse(atob(session.access_token.split('.')[1]));
      const trialEnd = payload.user_metadata?.trial_end;
      if (!trialEnd) return false;
      return new Date(trialEnd) > new Date();
    } catch {
      return false;
    }
  }
}