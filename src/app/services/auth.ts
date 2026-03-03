import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, Session, User } from '@supabase/supabase-js';
import { Router } from '@angular/router';
import { environment } from '../../environment/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private supabase: SupabaseClient | null = null;

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // ---------------- REACTIVE STATE ----------------
  currentUser = signal<User | null>(null);
  currentSession = signal<Session | null>(null);
  isLoading = signal<boolean>(true);

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

  // =====================================================
  // INITIALIZE AUTH (RESTORE SESSION + LISTEN CHANGES)
  // =====================================================
  private async initializeAuth(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        console.error('Session restore error:', error.message);
      }

      this.currentSession.set(data.session);
      this.currentUser.set(data.session?.user ?? null);

    } catch (err) {
      console.error('Unexpected session restore error:', err);
    } finally {
      this.isLoading.set(false);
    }

    this.supabase.auth.onAuthStateChange((event, session) => {
      this.currentSession.set(session);
      this.currentUser.set(session?.user ?? null);

      if (event === 'SIGNED_IN') {
        this.router.navigate(['/dashboard']);
      }

      if (event === 'SIGNED_OUT') {
        this.router.navigate(['/login']);
      }
    });
  }

  // =====================================================
  // GOOGLE LOGIN (WITH DRIVE SCOPES)
  // =====================================================
async loginWithGoogle(): Promise<void> {
  if (!this.supabase || !this.isBrowser) return;

  this.isLoading.set(true);

  const { error } = await this.supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly',
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    },
  });

  if (error) {
    this.isLoading.set(false);
    console.error('Login error:', error.message);
    throw error;
  }
}
  // =====================================================
  // LOGOUT
  // =====================================================
  async logout(): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.auth.signOut();
  }

  // =====================================================
  // GET SUPABASE ACCESS TOKEN (JWT)
  // =====================================================
  async getSupabaseAccessToken(): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  // =====================================================
  // GET GOOGLE ACCESS TOKEN (FOR DRIVE API)
  // =====================================================
  async getGoogleAccessToken(): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase.auth.getSession();
    return data.session?.provider_token ?? null;
  }

  // =====================================================
  // GET GOOGLE REFRESH TOKEN (IMPORTANT FOR BACKEND)
  // =====================================================
  async getGoogleRefreshToken(): Promise<string | null> {
    if (!this.supabase) return null;

    const { data } = await this.supabase.auth.getSession();
    return data.session?.provider_refresh_token ?? null;
  }

  // =====================================================
  // QUICK CHECK
  // =====================================================
  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  // =====================================================
  // CHECK PAID CLAIM FROM CUSTOM JWT HOOK
  // =====================================================
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