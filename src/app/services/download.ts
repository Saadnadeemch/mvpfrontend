import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment';

export interface DownloadRequest {
  url: string;
  quality: string;
  audioOnly: boolean;
  cloudUpload: boolean;
}

export interface VideoInfo {
  title?: string;
  thumbnail?: string;
  description?: string;
  views?: number;
  likes?: string;
  comments?: string;
  uploader?: string;
  url?: string;
}

export interface DownloadResponse {
  request_id: string;
  video_info: VideoInfo | null;
}

@Injectable({
  providedIn: 'root',
})
export class DownloadService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl; // NestJS base URL

  createDownload(
    payload: DownloadRequest,
    token: string,
  ): Observable<DownloadResponse> {
    console.log('[DownloadService] Creating download:', payload);
    return this.http.post<DownloadResponse>(
      `${this.baseUrl}/api/video`,
      payload,
      {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      },
    );
  }

  /**
   * Connect to the NestJS SSE bridge instead of Go directly.
   * NestJS forwards all Go events and handles DB updates internally.
   * The token is passed as a query param because EventSource doesn't
   * support custom headers.
   */
  connectToStream(requestId: string, token: string): EventSource {
    const url = `${this.baseUrl}/api/video/stream/${requestId}?token=${encodeURIComponent(token)}`;
    return new EventSource(url);
  }

}