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

            this.zone.run(() => {
              this.currentSession.set(session);
              this.currentUser.set(session.user ?? null);
              this.isLoading.set(false);
            });

            // Pass full session so syncAndRefresh can extract provider tokens
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
          this.router.navigate(['/']);
        }
      });
    }
  }

  private async syncAndRefresh(session: Session): Promise<void> {
    try {
      // provider_token  = Google access token  (valid ~60 min, available only at login)
      // provider_refresh_token = Google refresh token (long-lived, available only at login)
      // Both are ONLY present on the session object right after OAuth completes.
      // After a Supabase JWT refresh these fields become null, so we must save
      // them to the backend NOW before they disappear.
      const syncPayload: Record<string, unknown> = {};

      if (session.provider_token) {
        syncPayload['google_access_token'] = session.provider_token;
      }

      if (session.provider_refresh_token) {
        syncPayload['google_refresh_token'] = session.provider_refresh_token;
      }

      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/api/auth/sync`,
          syncPayload,
          { headers: this.authHeaders(session) }
        )
      );
    } catch (err) {
      console.error('[Auth] sync error:', err);
    }

    await this.refreshSession();
  }

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
        // Added drive.file scope — this is what allows uploading to the user's Drive.
        // drive.file = only files created by this app (safer, less scary for users
        // than full drive access). Without this scope, provider_token won't
        // have Drive permissions and the Go engine upload will fail with 403.
        scopes: [
          'openid',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/drive.file',
        ].join(' '),
        queryParams: {
          access_type: 'offline',  // This is what gives us the refresh token
          prompt: 'consent',       // Forces Google to show consent screen so
                                   // refresh token is always issued (without
                                   // this, returning users may not get one)
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

  async getDriveStorage(): Promise<{ used_gb: number; total_gb: number; percent: number }> {
  try {
    const session = this.currentSession();
    if (!session) return { used_gb: 0, total_gb: 0, percent: 0 };

    return await firstValueFrom(
      this.http.get<{ used_gb: number; total_gb: number; percent: number }>(
        `${environment.apiUrl}/api/user/drive-storage`,
        { headers: this.authHeaders(session) },
      )
    );
  } catch {
    return { used_gb: 0, total_gb: 0, percent: 0 };
  }
}


  async getDownloads(): Promise<any[]> {
  if (!this.supabase) return [];

  const user = this.currentUser();
  if (!user) return [];

  const { data, error } = await this.supabase
    .from('downloads')
    .select('id, title, thumbnail, platform, quality, requested_at, video_page_url, status, cloud_url, uploader, views')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('requested_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[Auth] getDownloads error:', error.message);
    return [];
  }

  return data ?? [];
}
  // Returns the Google OAuth access token from the current Supabase session.
  // NOTE: This is the Supabase-managed token, NOT the one we store in DB.
  // After the first JWT refresh, provider_token becomes null in the session,
  // so this will only return a value immediately after login.
  // For video download requests, the backend fetches the token from DB
  // (and refreshes it if needed) — frontend does NOT need to pass it.
  getProviderToken(): string | null {
    if (!this.isBrowser) return null;
    return this.currentSession()?.provider_token ?? null;
  }
}