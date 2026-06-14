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

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private downloadSvc = inject(DownloadService);
  private navState = inject(NavigationStateService);
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private audioService = inject(Playaudio);

  progress = signal(0);
  statusMessage = signal('Initializing...');
  isCompleted = signal(false);
  cloudStatus = signal<CloudStatus>('idle');
  cloudMessage = signal('');
  cloudUrl = signal<string | null>(null);
  hasError = signal(false);
  errorMessage = signal('');
  videoData = signal<VideoData | null>(null);
  finalDownloadUrl = signal<string | null>(null);
  copyState = signal<'idle' | 'copied'>('idle');

  private downloadDone = false;

  private readonly API_BASE = 'https://videosaver.online';
  private eventSource: EventSource | null = null;

  ngOnInit(): void {
    console.log('[Download] Component initialized');
    const params = this.route.snapshot.queryParams;
    const requestId = params['requestId']?.trim();

    console.log('[Download] Query params retrieved - requestId:', requestId);

    if (!requestId) {
      console.error('[Download] Invalid or missing request ID');
      this.setError('Invalid request ID.');
      return;
    }

    const videoInfo = this.navState.getVideoInfo();
    console.log('[Download] Video info retrieved from navigation state:', videoInfo);
    
    this.navState.clear();
    console.log('[Download] Navigation state cleared');
    
    this.videoData.set(this.buildVideoData(videoInfo, params));
    console.log('[Download] Video data built and set');

    if (isPlatformBrowser(this.platformId)) {
      console.log('[Download] Running in browser environment');
      const token = this.authService.currentSession()?.access_token ?? '';
      console.log('[Download] Auth token available:', !!token);
      this.connectStream(requestId, token);
    } else {
      console.log('[Download] Not running in browser environment, skipping stream connection');
    }
  }

  ngOnDestroy(): void {
    console.log('[Download] Component destroyed');
    if (this.eventSource) {
      console.log('[Download] Closing event source connection');
      this.eventSource.close();
    }
  }

  private connectStream(requestId: string, token: string): void {
    console.log('[Download] Connecting to event stream for requestId:', requestId);
    this.eventSource = this.downloadSvc.connectToStream(requestId, token);

    this.eventSource.onmessage = (event: MessageEvent) => {
      console.log('[Download] Message received from stream');
      let data: Record<string, any>;
      try {
        data = JSON.parse(event.data);
        console.log('[Download] Event data parsed:', data);
      } catch (error) {
        console.error('[Download] Failed to parse event data:', error);
        return;
      }
      this.handleEvent(data);
    };

    this.eventSource.onerror = () => {
      console.error('[Download] Event stream error occurred');
      if (this.downloadDone) {
        console.log('[Download] Download already done, closing stream');
        this.eventSource?.close();
        return;
      }
      console.error('[Download] Connection lost, setting error state');
      this.setError('Connection lost. Please try again.');
      this.eventSource?.close();
    };
  }

  private handleEvent(data: Record<string, any>): void {
    console.log('[Download] Handling event:', data);
    
    if (data['video_info']) {
      console.log('[Download] Video info event received, updating video data');
      this.videoData.update(prev =>
        this.buildVideoData(data['video_info'], { url: prev?.requestedUrl }),
      );
      return;
    }

    if (typeof data['percent'] === 'number') {
      console.log('[Download] Progress update:', data['percent'] + '%');
      this.progress.set(data['percent']);
    }
    
    if (data['message']) {
      console.log('[Download] Status message:', data['message']);
      this.statusMessage.set(data['message']);
    }

    switch (data['status']) {

      case 'downloading':
        console.log('[Download] Download in progress');
        break;

      case 'stream_end':
        console.log('[Download] Stream end signal received');
        this.eventSource?.close();
        break;

      case 'completed': {
        console.log('[Download] Download completed event received');
        const rawUrl: string =
          data['result']?.download_url ??
          data['download_url'] ??
          data['url'] ??
          '';

        console.log('[Download] Raw download URL:', rawUrl ? rawUrl.substring(0, 50) + '...' : 'MISSING');

        if (!rawUrl) {
          console.error('[Download] Download URL is missing from response');
          this.markDone();
          this.setError('Download finished but the file URL was missing. Please try again.');
          this.eventSource?.close();
          return;
        }

        const resolvedUrl = this.resolveUrl(rawUrl);
        console.log('[Download] URL resolved:', resolvedUrl.substring(0, 50) + '...');
        this.finalDownloadUrl.set(resolvedUrl);
        this.markDone();
        console.log('[Download] Playing completion audio');
        this.audioService.playCompletion();
        break;
      }

      case 'uploading':
        console.log('[Download] Cloud upload started');
        this.cloudStatus.set('uploading');
        this.cloudMessage.set(data['message'] ?? 'Uploading to Google Drive...');
        break;

      case 'cloud_success':
        console.log('[Download] Cloud upload successful');
        this.cloudUrl.set(data['cloud_url'] ?? null);
        this.cloudStatus.set('success');
        this.cloudMessage.set(data['message'] ?? 'Uploaded to Google Drive!');
        console.log('[Download] Cloud URL:', data['cloud_url']);
        this.markDone();
        this.eventSource?.close();
        break;

      case 'cloud_error':
        console.error('[Download] Cloud upload failed');
        this.cloudStatus.set('error');
        this.cloudMessage.set(data['message'] ?? 'Drive upload failed.');
        this.markDone();
        this.eventSource?.close();
        break;

      case 'error':
        console.error('[Download] Error event received:', data['message']);
        this.setError(data['message'] ?? 'Something went wrong.');
        this.eventSource?.close();
        break;

      default:
        console.warn('[Download] Unknown event status:', data['status']);
    }
  }

  saveVideo(): void {
    console.log('[Download] Save video initiated');
    const url = this.finalDownloadUrl();
    
    if (!url) {
      console.error('[Download] Download URL not available for save');
      this.setError('Download URL not available.');
      return;
    }

    console.log('[Download] Creating download link for URL:', url.substring(0, 50) + '...');
    const link = document.createElement('a');
    link.href = url;
    link.download = this.videoData()?.title || 'video.mp4';
    console.log('[Download] Download filename:', link.download);
    
    document.body.appendChild(link);
    console.log('[Download] Triggering download');
    link.click();
    document.body.removeChild(link);
    console.log('[Download] Download link cleaned up');
  }

  copyDriveLink(): void {
    console.log('[Download] Copy Drive link initiated');
    const url = this.cloudUrl();
    
    if (!url) {
      console.warn('[Download] Cloud URL not available for copy');
      return;
    }

    console.log('[Download] Copying to clipboard:', url.substring(0, 50) + '...');
    navigator.clipboard.writeText(url).then(() => {
      console.log('[Download] Successfully copied to clipboard');
      this.copyState.set('copied');
      setTimeout(() => {
        console.log('[Download] Resetting copy state');
        this.copyState.set('idle');
      }, 1500);
    }).catch(error => {
      console.error('[Download] Failed to copy to clipboard:', error);
    });
  }

  onThumbnailError(): void {
    console.warn('[Download] Thumbnail load failed, using default image');
    this.videoData.update(v => v ? { ...v, thumbnail: 'default.png' } : null);
  }

  goHome(): void {
    console.log('[Download] Navigating back to home');
    this.router.navigate(['/']);
  }

  private markDone(): void {
    console.log('[Download] Marking download as done');
    this.downloadDone = true;
    this.isCompleted.set(true);
  }

  private setError(message: string): void {
    console.error('[Download] Setting error:', message);
    this.hasError.set(true);
    this.errorMessage.set(message);
  }

  private resolveUrl(rawUrl: string): string {
    console.log('[Download] Resolving URL:', rawUrl.substring(0, 50) + '...');
    
    if (!rawUrl) {
      console.warn('[Download] Empty URL provided to resolveUrl');
      return '';
    }

    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      console.log('[Download] URL is absolute, returning as-is');
      return rawUrl;
    }

    const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    const encodedPath = `${this.API_BASE}${encodeURI(path)}`;
    console.log('[Download] URL resolved to:', encodedPath.substring(0, 50) + '...');
    return encodedPath;
  }

  private buildVideoData(info: VideoInfo | null, params: Record<string, any>): VideoData {
    console.log('[Download] Building video data from info:', !!info);
    
    const videoData: VideoData = {
      title: info?.title ?? '',
      thumbnail: info?.thumbnail ?? '',
      description: info?.description ?? '',
      views: info?.views ?? 0,
      likes: info?.likes ?? '—',
      comments: info?.comments ?? '—',
      uploader: info?.uploader ?? '',
      requestedUrl: info?.url ?? params['url'] ?? '',
    };

    console.log('[Download] Video data built:', {
      title: videoData.title,
      uploader: videoData.uploader,
      views: videoData.views
    });

    return videoData;
  }
}
