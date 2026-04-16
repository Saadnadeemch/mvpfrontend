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
  private baseUrl = environment.apiUrl;
  private engine = environment.EngineUrl;

  createDownload(
    payload: DownloadRequest,
    token: string,
  ): Observable<DownloadResponse> {
    console.log('[DownloadService] Creating download with payload:', payload);
    return this.http.post<DownloadResponse>(
      `${this.baseUrl}/api/video`,
      payload,
      {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      },
    );
  }

  connectToStream(requestId: string): EventSource {
    return new EventSource(`${this.engine}/stream/${requestId}`);
  }

  // Called after SSE signals completion — tells NestJS to update DB status
  markComplete(
    requestId: string,
    token: string,
    cloudUrl: string | null,
  ): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.baseUrl}/api/video/complete`,
      { request_id: requestId, cloud_url: cloudUrl },
      {
        headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
      },
    );
  }
}