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

  progress = signal(0);
  statusMessage = signal('Initializing...');
  isCompleted = signal(false);
  hasError = signal(false);
  errorMessage = signal('');
  videoData = signal<VideoData | null>(null);
  finalDownloadUrl = signal<string | null>(null);

  // private readonly API_BASE = 'http://localhost:8080'; // fallback if environment variable is missing
  private readonly API_BASE = 'https://videosaver.online'; 

  private eventSource: EventSource | null = null;

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    console.log('[Download] Query params:', params);

    const requestId: string = params['requestId'];
    if (!requestId?.trim()) {
      console.error('[Download] Missing requestId');
      this.hasError.set(true);
      this.errorMessage.set('Invalid request ID.');
      return;
    }

    // Read videoInfo from shared service (set by Home before navigating)
    const info = this.navState.getVideoInfo();
    console.log('[Download] videoInfo from NavigationStateService:', info);
    this.navState.clear(); // consume it so it doesn't linger

    this.videoData.set(this.buildVideoData(info, params));

    // EventSource only works in the browser — skip on SSR server render
    if (isPlatformBrowser(this.platformId)) {
      this.listenToStream(requestId);
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

  // Ensure path starts with slash
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;

  // Encode URI to handle spaces, Arabic letters, emojis, etc.
  return `${this.API_BASE}${encodeURI(path)}`;
}

  private listenToStream(requestId: string) {
    console.log('[Download] Connecting to SSE stream for requestId:', requestId);
    this.eventSource = this.downloadService.connectToStream(requestId);

    // Use only onmessage to prevent duplicate handler firing
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

      // SSE video_info update (some backends send this mid-stream)
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

      // Completion — final message carries result.download_url
      if (data.status === 'completed') {
        console.log('[Download] Status completed. Full SSE payload:', data);

        const result = data.result;
        console.log('[Download] result:', result);

        const rawUrl: string = result?.download_url ?? '';
        console.log('[Download] download_url:', rawUrl);

        if (!rawUrl) {
          // Not the final message yet (intermediate "completed" without result) — keep waiting
          console.warn('[Download] No download_url yet, waiting for final message...');
          return;
        }

        const resolvedUrl = this.resolveUrl(rawUrl);
        console.log('[Download] Resolved download URL:', resolvedUrl);

        this.finalDownloadUrl.set(resolvedUrl);
        this.isCompleted.set(true);
        this.eventSource?.close();
      }
    };

    this.eventSource.onerror = () => {
      // Only treat as error if download hasn't completed
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

  // Use the original file name from videoData if available
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