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
import { NavbarComponent } from "../../components/navbar/navbar";
import { Playaudio } from '../../services/playaudio';

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
  imports: [CommonModule, MatIconModule, NavbarComponent],
  templateUrl: './download.html',
  styleUrl: './download.css',
})
export class Download implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private downloadService = inject(DownloadService);
  private navState = inject(NavigationStateService);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private audioService = inject(Playaudio);

  progress = signal(0);
  statusMessage = signal('Initializing...');
  isCompleted = signal(false);
  cloudStatus = signal<'idle' | 'uploading' | 'success' | 'error'>('idle');
  cloudMessage = signal('');
  cloudUrl = signal<string | null>(null);
  hasError = signal(false);
  errorMessage = signal('');
  videoData = signal<VideoData | null>(null);
  finalDownloadUrl = signal<string | null>(null);
  copyState = signal<'idle' | 'copied'>('idle');

  private readonly API_BASE = 'https://buckty.cloud';

  private eventSource: EventSource | null = null;
  private requestId: string = '';
  private authToken: string = '';

  ngOnInit() {
    const params = this.route.snapshot.queryParams;
    this.requestId = params['requestId'];

    if (!this.requestId?.trim()) {
      this.hasError.set(true);
      this.errorMessage.set('Invalid request ID.');
      return;
    }

    this.authToken = this.authService.currentSession()?.access_token ?? '';

    const info = this.navState.getVideoInfo();
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
    // Token passed as query param — EventSource doesn't support custom headers
    this.eventSource = this.downloadService.connectToStream(requestId, this.authToken);

    this.eventSource.onmessage = (event: MessageEvent) => {
      let data: any;
      try {
        data = JSON.parse(event.data);
      } catch {
        console.error('[Download] Failed to parse SSE payload:', event.data);
        return;
      }

      // Mid-stream video info update
      if (data.video_info) {
        this.videoData.update(prev => this.buildVideoData(data.video_info, { url: prev?.requestedUrl }));
        return;
      }

      if (typeof data.percent === 'number') {
        this.progress.set(data.percent);
      }
      if (data.message) {
        this.statusMessage.set(data.message);
      }

      switch (data.status) {

        case 'completed': {
          const rawUrl: string = data.result?.download_url ?? '';
          if (!rawUrl) {
            console.warn('[Download] completed event has no download_url');
            return;
          }
          this.finalDownloadUrl.set(this.resolveUrl(rawUrl));
          this.isCompleted.set(true);
          // SSE stays open — cloud events may still follow if upload was requested
          this.audioService.playCompletion();
          break;
        }

        case 'uploading': {
          this.cloudStatus.set('uploading');
          this.cloudMessage.set(data.message ?? 'Uploading to Google Drive...');
          break;
        }

        case 'cloud_success': {
          this.cloudUrl.set(data.cloud_url ?? null);
          this.cloudStatus.set('success');
          this.cloudMessage.set(data.message ?? 'Uploaded to Google Drive!');
          this.eventSource?.close();
          // DB update handled automatically by NestJS SSE interception
          break;
        }

        case 'cloud_error': {
          this.cloudStatus.set('error');
          this.cloudMessage.set(data.message ?? 'Drive upload failed.');
          this.eventSource?.close();
          // DB update handled automatically by NestJS SSE interception
          break;
        }

        case 'error': {
          this.hasError.set(true);
          this.errorMessage.set(data.message ?? 'Something went wrong.');
          this.eventSource?.close();
          break;
        }
      }
    };

    this.eventSource.onerror = () => {
      if (!this.isCompleted()) {
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

  onThumbnailError() {
    this.videoData.update(v => v ? { ...v, thumbnail: 'default.png' } : null);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  copyDriveLink() {
    const url = this.cloudUrl();
    if (!url) {
      console.warn('No cloud URL available to copy');
      return;
    }
    navigator.clipboard.writeText(url).then(() => {
      this.copyState.set('copied');
      setTimeout(() => this.copyState.set('idle'), 1500);
    }).catch(err => {
      console.error('Clipboard write failed:', err);
    });
  }

  ngOnDestroy() {
    this.eventSource?.close();
  }
}