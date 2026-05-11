import {
  ChangeDetectionStrategy,
  Component,
  signal,
  OnInit,
  OnDestroy,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { DownloadService, VideoInfo } from '../../services/download';
import { NavigationStateService } from '../../services/navigationsate';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../../components/navbar/navbar';
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

type CloudStatus = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, MatIconModule, NavbarComponent],
  templateUrl: './download.html',
  styleUrl: './download.css',
})
export class Download implements OnInit, OnDestroy {

  private route        = inject(ActivatedRoute);
  private router       = inject(Router);
  private downloadSvc  = inject(DownloadService);
  private navState     = inject(NavigationStateService);
  private platformId   = inject(PLATFORM_ID);
  private authService  = inject(AuthService);
  private audioService = inject(Playaudio);

  progress         = signal(0);
  statusMessage    = signal('Initializing...');
  isCompleted      = signal(false);
  cloudStatus      = signal<CloudStatus>('idle');
  cloudMessage     = signal('');
  cloudUrl         = signal<string | null>(null);
  hasError         = signal(false);
  errorMessage     = signal('');
  videoData        = signal<VideoData | null>(null);
  finalDownloadUrl = signal<string | null>(null);
  copyState        = signal<'idle' | 'copied'>('idle');

  // Plain boolean so onerror can read it synchronously before Angular's
  // next CD cycle flushes the isCompleted signal write.
  private downloadDone = false;

  private readonly API_BASE = 'http://localhost:8080';
  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    const params    = this.route.snapshot.queryParams;
    const requestId = params['requestId']?.trim();

    if (!requestId) {
      this.setError('Invalid request ID.');
      return;
    }

    const videoInfo = this.navState.getVideoInfo();
    this.navState.clear();
    this.videoData.set(this.buildVideoData(videoInfo, params));

    if (isPlatformBrowser(this.platformId)) {
      const token = this.authService.currentSession()?.access_token ?? '';
      this.connectStream(requestId, token);
    }
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }

  private connectStream(requestId: string, token: string): void {
    this.eventSource = this.downloadSvc.connectToStream(requestId, token);

    this.eventSource.onmessage = (event: MessageEvent) => {
      let data: Record<string, any>;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      this.handleEvent(data);
    };

    this.eventSource.onerror = () => {
      if (this.downloadDone) {
        this.eventSource?.close();
        return;
      }
      this.setError('Connection lost. Please try again.');
      this.eventSource?.close();
    };
  }

  private handleEvent(data: Record<string, any>): void {
    if (data['video_info']) {
      this.videoData.update(prev =>
        this.buildVideoData(data['video_info'], { url: prev?.requestedUrl }),
      );
      return;
    }

    if (typeof data['percent'] === 'number') this.progress.set(data['percent']);
    if (data['message']) this.statusMessage.set(data['message']);

    switch (data['status']) {

      case 'downloading':
        break;

      case 'stream_end':
        this.eventSource?.close();
        break;

      case 'completed': {
        const rawUrl: string =
          data['result']?.download_url ??
          data['download_url']         ??
          data['url']                  ??
          '';

        if (!rawUrl) {
          this.markDone();
          this.setError('Download finished but the file URL was missing. Please try again.');
          this.eventSource?.close();
          return;
        }

        this.finalDownloadUrl.set(this.resolveUrl(rawUrl));
        this.markDone();
        this.audioService.playCompletion();
        break;
      }

      case 'uploading':
        this.cloudStatus.set('uploading');
        this.cloudMessage.set(data['message'] ?? 'Uploading to Google Drive...');
        break;

      case 'cloud_success':
        this.cloudUrl.set(data['cloud_url'] ?? null);
        this.cloudStatus.set('success');
        this.cloudMessage.set(data['message'] ?? 'Uploaded to Google Drive!');
        this.markDone();
        this.eventSource?.close();
        break;

      case 'cloud_error':
        this.cloudStatus.set('error');
        this.cloudMessage.set(data['message'] ?? 'Drive upload failed.');
        this.markDone();
        this.eventSource?.close();
        break;

      case 'error':
        this.setError(data['message'] ?? 'Something went wrong.');
        this.eventSource?.close();
        break;
    }
  }

  saveVideo(): void {
    const url = this.finalDownloadUrl();
    if (!url) {
      this.setError('Download URL not available.');
      return;
    }
    const link    = document.createElement('a');
    link.href     = url;
    link.download = this.videoData()?.title || 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  copyDriveLink(): void {
    const url = this.cloudUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.copyState.set('copied');
      setTimeout(() => this.copyState.set('idle'), 1500);
    });
  }

  onThumbnailError(): void {
    this.videoData.update(v => v ? { ...v, thumbnail: 'default.png' } : null);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  private markDone(): void {
    this.downloadDone = true;
    this.isCompleted.set(true);
  }

  private setError(message: string): void {
    this.hasError.set(true);
    this.errorMessage.set(message);
  }

  private resolveUrl(rawUrl: string): string {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
    const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${this.API_BASE}${encodeURI(path)}`;
  }

  private buildVideoData(info: VideoInfo | null, params: Record<string, any>): VideoData {
    return {
      title:        info?.title       ?? '',
      thumbnail:    info?.thumbnail   ?? '',
      description:  info?.description ?? '',
      views:        info?.views       ?? 0,
      likes:        info?.likes       ?? '—',
      comments:     info?.comments    ?? '—',
      uploader:     info?.uploader    ?? '',
      requestedUrl: info?.url         ?? params['url'] ?? '',
    };
  }
}