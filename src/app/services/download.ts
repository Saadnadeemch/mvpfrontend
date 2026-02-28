import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment';

export interface DownloadRequest {
  url: string;
  quality: string;
  audioOnly: boolean;
  uiId: string;
  userId: string;
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
  private baseUrl = environment.apiBaseUrl;

  createDownload(payload: DownloadRequest): Observable<DownloadResponse> {
    return this.http.post<DownloadResponse>(`${this.baseUrl}/video`, payload);
  }

  // NOTE: EventSource is browser-only. Always guard with isPlatformBrowser before calling.
  connectToStream(requestId: string): EventSource {
    return new EventSource(`${this.baseUrl}/stream/${requestId}`);
  }
}