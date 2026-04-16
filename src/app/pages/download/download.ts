import {
  ChangeDetectionStrategy,
  Component,
  signal,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { DownloadService, VideoInfo } from '../../services/download';
import { NavigationStateService } from '../../services/navigationsate';
import { AuthService } from '../../services/auth.service';

interface VideoData {
  title: string;
  thumbnail: string;
  description: string;
  views: number | string;
  likes: string;
  comments: string;
  uploader: string;
  requestedUrl: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './download.html',
  styles: [`
    .svg-border-container {
      position: absolute;
      inset: -5px;
      width: calc(100% + 10px);
      height: calc(100% + 10px);
      pointer-events: none;
      z-index: 10;
      overflow: visible;
    }
    .svg-track-rect {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 3;
      opacity: 0.15;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .svg-border-rect {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 3;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      transition: stroke-dashoffset 0.6s ease-in-out;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `]
})
export class Download implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private downloadService = inject(DownloadService);
  private navState = inject(NavigationStateService);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService)

  progress = signal(0);
  statusMessage = signal('Initializing...');
  isCompleted = signal(false);
  hasError = signal(false);
  errorMessage = signal('');
  videoData = signal<VideoData | null>(null);
  finalDownloadUrl = signal<string | null>(null);

  private readonly API_BASE = 'https://videosaver.online';

  private eventSource: EventSource | null = null;
  private requestId: string = '';
  private authToken: string = '';  // store token for markComplete call

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    console.log('[Download] Query params:', params);

    this.requestId = params['requestId'];
    if (!this.requestId?.trim()) {
      console.error('[Download] Missing requestId');
      this.hasError.set(true);
      this.errorMessage.set('Invalid request ID.');
      return;
    }

    this.authToken = this.authService.currentSession()?.access_token ?? '';

    const info = this.navState.getVideoInfo();
    console.log('[Download] videoInfo from NavigationStateService:', info);
    this.navState.clear();

    this.videoData.set(this.buildVideoData(info, params));

    if (isPlatformBrowser(this.platformId)) {
      this.listenToStream(this.requestId);
    }
  }

  private buildVideoData(info: VideoInfo | null, params: any): VideoData {
    return {
      title: info?.title ?? '',
      thumbnail: info?.thumbnail ?? '',
      description: info?.description ?? '',
      views: info?.views ?? 0,
      likes: info?.likes ?? '—',
      comments: info?.comments ?? '—',
      uploader: info?.uploader ?? '',
      requestedUrl: info?.url ?? params['url'] ?? ''
    };
  }

  private resolveUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${this.API_BASE}${encodeURI(path)}`;
  }

  private listenToStream(requestId: string) {
    console.log('[Download] Connecting to SSE stream for requestId:', requestId);
    this.eventSource = this.downloadService.connectToStream(requestId);

    this.eventSource.onmessage = (event: MessageEvent) => {
      console.log('[Download] Raw SSE data:', event.data);

      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.error('[Download] Failed to parse SSE payload:', event.data);
        return;
      }

      console.log('[Download] Parsed SSE payload:', data);

      // Mid-stream video_info update
      if (data.video_info) {
        console.log('[Download] SSE video_info update:', data.video_info);
        this.videoData.update(prev => this.buildVideoData(data.video_info, { url: prev?.requestedUrl }));
        return;
      }

      // Progress update
      if (typeof data.percent === 'number') {
        this.progress.set(data.percent);
        this.statusMessage.set(data.message ?? '');
        console.log(`[Download] Progress: ${data.percent}% | status: ${data.status}`);
      }

      // Completion
      if (data.status === 'completed') {
        console.log('[Download] Status completed. Full SSE payload:', data);

        const result = data.result;
        console.log('[Download] result:', result);

        const rawUrl: string = result?.download_url ?? '';
        console.log('[Download] download_url:', rawUrl);

        if (!rawUrl) {
          console.warn('[Download] No download_url yet, waiting for final message...');
          return;
        }

        const resolvedUrl = this.resolveUrl(rawUrl);
        console.log('[Download] Resolved download URL:', resolvedUrl);

        this.finalDownloadUrl.set(resolvedUrl);
        this.isCompleted.set(true);
        this.eventSource?.close();

        // Tell NestJS to update DB status to completed
        // Only call if we have a token — anonymous users don't have DB records
        if (this.authToken) {
          const cloudUrl = result?.cloud_url ?? null;
          console.log('[Download] Notifying backend of completion — request_id:', requestId, '| cloud_url:', cloudUrl);

          this.downloadService.markComplete(requestId, this.authToken, cloudUrl).subscribe({
            next: (res) => console.log('[Download] Backend marked complete:', res),
            error: (err) => console.error('[Download] Failed to notify backend of completion:', err),
          });
        } else {
          console.log('[Download] No auth token — skipping backend completion notify (anonymous user)');
        }
      }
    };

    this.eventSource.onerror = () => {
      if (!this.isCompleted()) {
        console.error('[Download] SSE connection error');
        this.hasError.set(true);
        this.errorMessage.set('Connection lost. Please try again.');
      }
      this.eventSource?.close();
    };
  }

  saveVideo() {
    const url = this.finalDownloadUrl();
    if (!url) {
      this.hasError.set(true);
      this.errorMessage.set('Download URL not available.');
      return;
    }

    const fileName = this.videoData()?.title || 'video.mp4';
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }
}