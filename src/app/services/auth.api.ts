import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environment/environment';
import { UserProfile, SelectPlanPayload, DriveStorage } from './Models/auth.model';
import { Session, SupabaseClient } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private http = inject(HttpClient);

  private authHeaders(session: Session): HttpHeaders {
    if (!session?.access_token) {
      throw new Error('No auth token available');
    }

    return new HttpHeaders({
      Authorization: `Bearer ${session.access_token}`,
    });
  }

  async getProfile(session: Session): Promise<UserProfile | null> {
    try {
      return await firstValueFrom(
        this.http.get<UserProfile>(
          `${environment.apiUrl}/api/user/profile`,
          { headers: this.authHeaders(session) }
        )
      );
    } catch (err) {
      console.error('[AuthApi] getProfile error:', err);
      return null;
    }
  }

  async savePlanSelection(
    session: Session,
    payload: SelectPlanPayload
  ): Promise<{ error: string | null }> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/api/user/plan`,
          payload,
          { headers: this.authHeaders(session) }
        )
      );

      return { error: null };
    } catch (err: any) {
      return { error: err?.message ?? 'Failed to save plan' };
    }
  }

  async getDriveStorage(session: Session): Promise<DriveStorage> {
    const fallback: DriveStorage = { used_gb: 0, total_gb: 0, percent: 0 };

    try {
      return await firstValueFrom(
        this.http.get<DriveStorage>(
          `${environment.apiUrl}/api/user/drive-storage`,
          { headers: this.authHeaders(session) }
        )
      );
    } catch {
      return fallback;
    }
  }

  async getDownloads(
    supabase: SupabaseClient,
    userId: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('downloads')
      .select('id, title, thumbnail, platform, quality, requested_at, video_page_url, status, cloud_url, uploader, views, video_type, audio_only')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('requested_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[AuthApi] getDownloads error:', error.message);
      return [];
    }

    return data ?? [];
  }

  async syncProviderTokens(session: Session): Promise<void> {
    const payload: Record<string, unknown> = {};

    if (session.provider_token) {
      payload['google_access_token'] = session.provider_token;
    }

    if (session.provider_refresh_token) {
      payload['google_refresh_token'] = session.provider_refresh_token;
    }

    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/api/auth/sync`,
          payload,
          { headers: this.authHeaders(session) }
        )
      );
    } catch (err) {
      console.error('[AuthApi] syncProviderTokens error:', err);
    }
  }
}