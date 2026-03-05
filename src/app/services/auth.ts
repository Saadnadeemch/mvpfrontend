import { Injectable, signal, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environment/environment';

export interface UserProfile {
  user_id: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
  is_paid?: boolean;
  membership_type?: 'free' | 'monthly' | 'yearly';
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
  plan: 'basic' | 'pro';
  isAnnual: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private supabase: SupabaseClient | null = null;
  private platformId = inject(PLATFORM_ID);
  private isBrowser  = isPlatformBrowser(this.platformId);
  private zone       = inject(NgZone);

  currentUser    = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  isLoading      = signal<boolean>(true);

  // ─── Session-ready promise ───────────────────────────────────────
  // IMPORTANT: This is intentionally NOT resolved during SSR.
  // It only ever resolves in the browser, after the auth state is known.
  // This prevents SSR's "no session" state from poisoning the promise
  // before the browser's OAuth exchange has a chance to complete.
  // ─────────────────────────────────────────────────────────────────
  private _sessionReadyResolve!: (v: boolean) => void;
  private _sessionReadyPromise  = new Promise<boolean>(res => {
    this._sessionReadyResolve = res;
  });

  // Tracks whether the promise has been resolved yet (guards double-resolve)
  private _sessionResolved = false;

  private resolveSession(value: boolean): void {
    if (this._sessionResolved) return;
    this._sessionResolved = true;
    this._sessionReadyResolve(value);
  }

  constructor(private router: Router) {
    if (!this.isBrowser) {
      // SSR: mark loading as done but DO NOT resolve the promise.
      // The promise must stay pending until the browser runs.
      this.isLoading.set(false);
      return;
    }

    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseAnonKey
    );

    this.initializeAuth();
  }

  // ─────────────────────────────────────────────────────────────────
  // INIT (browser only)
  //
  // Root cause of the original bug:
  //   After OAuth redirect, Supabase must exchange ?code= for a token.
  //   This is async. getSession() returns null before it's done.
  //   Meanwhile SSR had already "resolved" the promise as false.
  //   So waitForSessionReady() returned false instantly → /login.
  //
  // Fix:
  //   1. Never resolve the promise on the server.
  //   2. On OAuth callback URLs, skip getSession() and wait for the
  //      SIGNED_IN event from onAuthStateChange instead.
  //   3. On all other pages, use getSession() normally.
  // ─────────────────────────────────────────────────────────────────
  private initializeAuth(): void {
    if (!this.supabase) return;

    if (this.isOAuthCallbackUrl()) {
      // ── OAuth callback path ──────────────────────────────────────
      // Supabase will emit SIGNED_IN once the ?code= exchange is done.
      // We must NOT call getSession() here — it returns null too early.
      console.log('[Auth] OAuth callback detected — waiting for SIGNED_IN');

      // Safety timeout so the spinner never hangs forever
      const timer = setTimeout(() => {
        console.warn('[Auth] Timeout: no SIGNED_IN event after 10s');
        this.zone.run(() => this.isLoading.set(false));
        this.resolveSession(false);
      }, 10_000);

      const { data: { subscription } } = this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] onAuthStateChange:', event, '| has session:', !!session);

        if (event === 'SIGNED_IN') {
          clearTimeout(timer);

          this.zone.run(() => {
            this.currentSession.set(session);
            this.currentUser.set(session?.user ?? null);
            this.isLoading.set(false);
          });

          // Unsubscribe — we only need this one event on the callback page
          subscription.unsubscribe();
          this.resolveSession(true);
        }

        // Handle unexpected error/signout during exchange
        if (event === 'SIGNED_OUT') {
          clearTimeout(timer);
          subscription.unsubscribe();
          this.zone.run(() => this.isLoading.set(false));
          this.resolveSession(false);
        }
      });

    } else {
      // ── Normal page load path ────────────────────────────────────
      // getSession() is reliable here — no code to exchange.
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

      // Keep session in sync for logout / token refresh
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

  // ─────────────────────────────────────────────────────────────────
  // Detect OAuth callback URL
  // PKCE:     ?code=
  // Implicit: #access_token=
  // Error:    ?error= or #error=
  // ─────────────────────────────────────────────────────────────────
  private isOAuthCallbackUrl(): boolean {
    if (!this.isBrowser) return false;
    const { hash, search } = window.location;
    return (
      search.includes('code=')       ||
      search.includes('error=')      ||
      hash.includes('access_token=') ||
      hash.includes('error=')
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // waitForSessionReady
  // Always returns a real promise — never short-circuits on SSR state.
  // Safe to call from AuthCallback.ngOnInit().
  // ─────────────────────────────────────────────────────────────────
  waitForSessionReady(): Promise<boolean> {
    return this._sessionReadyPromise;
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
  // PROFILE — GET
  // ────────────────────────────────
  async getProfile(): Promise<UserProfile | null> {
    if (!this.supabase) return null;

    const user = this.currentUser();
    if (!user) return null;

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('getProfile error:', error.message);
      return null;
    }

    return data as UserProfile;
  }

  // ────────────────────────────────
  // PROFILE — UPSERT PLAN
  // ────────────────────────────────
  async savePlanSelection(payload: SelectPlanPayload): Promise<{ error: string | null }> {
    if (!this.supabase) return { error: 'No Supabase client' };

    const user = this.currentUser();
    if (!user) return { error: 'Not authenticated' };

    const now             = new Date();
    const trialStart      = now.toISOString();
    const trialEnd        = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const membershipStart = trialEnd;
    const billingDays     = payload.isAnnual ? 365 : 30;
    const nextBilling     = new Date(
      new Date(membershipStart).getTime() + billingDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // membership_type enum values: 'free' | 'monthly' | 'yearly'
    // This tracks the BILLING PERIOD, not the plan tier.
    // Plan tier (basic/pro) is stored separately in payment_price_id.
    const membershipType = payload.isAnnual ? 'yearly' : 'monthly';

    const updates = {
      user_id:           user.id,
      email:             user.email,
      full_name:         user.user_metadata?.['full_name'] ?? user.user_metadata?.['name'] ?? null,
      avatar_url:        user.user_metadata?.['avatar_url'] ?? null,
      membership_type:   membershipType,   // 'monthly' | 'yearly'
      payment_price_id:  payload.plan,     // 'basic' | 'pro' — plan tier stored here
      is_paid:           false,
      is_trial:          true,
      trial_start:       trialStart,
      trial_end:         trialEnd,
      membership_start:  membershipStart,
      membership_end:    nextBilling,
      next_billing_date: nextBilling,
      updated_at:        now.toISOString(),
    };

    console.log('[Auth] upserting | membership_type:', membershipType, '| plan tier:', payload.plan, '| user:', user.id);

    const { error } = await this.supabase
      .from('profiles')
      .upsert(updates, { onConflict: 'user_id' });

    if (error) {
      console.error('savePlanSelection error:', error.message);
      return { error: error.message };
    }

    return { error: null };
  }

  // ────────────────────────────────
  // CHECK: has user already picked a plan?
  // ────────────────────────────────
  async hasSelectedPlan(): Promise<boolean> {
    const profile = await this.getProfile();
    if (!profile) return false;
    // User has selected a plan if membership_type is monthly or yearly (not free/null)
    return profile.membership_type === 'monthly' || profile.membership_type === 'yearly';
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