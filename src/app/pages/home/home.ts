import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DownloadService } from '../../services/download';
import { AuthService } from '../../services/auth';
import { finalize } from 'rxjs';
import { NavigationStateService } from '../../services/navigationsate';

interface QualityOption {
  label: string;
  isPaid: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home implements OnDestroy {
  private router = inject(Router);
  private downloadService = inject(DownloadService);
  private navState = inject(NavigationStateService);
  private authService = inject(AuthService);

  url = signal('');
  isAudioOnly = signal(false);
  quality = signal('720p');
  isDownloading = signal(false);
  isDropdownOpen = signal(false);
  currentPlaceholderIndex = signal(0);
  placeholderText = signal('');

  qualities: QualityOption[] = [
    { label: '240p', isPaid: false },
    { label: '360p', isPaid: false },
    { label: '480p', isPaid: false },
    { label: '720p', isPaid: false },
    { label: '1080p', isPaid: false },
    { label: '1440p', isPaid: false },
    { label: '2080p', isPaid: false },
    { label: '4K', isPaid: false }
  ];

  private placeholders = [
    'Paste video URL here...',
    'Download from YouTube, Instagram...',
    'HD quality support...',
    'Audio only mode available...'
  ];

  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.startTypewriter();
  }

  private startTypewriter() {
    let charIndex = 0;
    let isDeleting = false;

    const type = () => {
      const fullText = this.placeholders[this.currentPlaceholderIndex()];
      isDeleting ? charIndex-- : charIndex++;
      this.placeholderText.set(fullText.substring(0, charIndex));

      let speed = isDeleting ? 30 : 60;

      if (!isDeleting && charIndex === fullText.length) {
        speed = 2000;
        isDeleting = true;
      }

      if (isDeleting && charIndex === 0) {
        isDeleting = false;
        this.currentPlaceholderIndex.update(i => (i + 1) % this.placeholders.length);
        speed = 500;
      }

      this.typingTimer = setTimeout(type, speed);
    };

    type();
  }

  toggleDropdown() {
    if (this.isAudioOnly()) return;
    this.isDropdownOpen.update(v => !v);
  }

  selectQuality(option: QualityOption) {
    if (option.isPaid) return;
    this.quality.set(option.label);
    this.isDropdownOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.quality-dropdown-container')) {
      this.isDropdownOpen.set(false);
    }
  }

  handleDownload() {
    if (!this.url().trim()) return;

    this.isDownloading.set(true);

    // Read JWT from current session — null if user is not logged in
    const token = this.authService.currentSession()?.access_token ?? '';
    const isLoggedIn = !!token;

    console.log('[Home] User logged in:', isLoggedIn);

    const payload = {
      url: this.url(),
      quality: this.quality(),
      audioOnly: this.isAudioOnly(),
      cloudUpload: true,
    };

    console.log('[Home] Sending payload:', {
      ...payload,
      token: token ? '[PRESENT]' : '[EMPTY — anonymous]',
    });

    this.downloadService.createDownload(payload, token)
      .pipe(finalize(() => this.isDownloading.set(false)))
      .subscribe({
        next: (res) => {
          console.log('[Home] API response:', res);
          const requestId = res.request_id;

          if (!requestId) {
            console.error('[Home] requestId missing in response:', res);
            alert('Server did not return a valid request ID.');
            return;
          }

          this.navState.setVideoInfo(res.video_info ?? null);
          console.log('[Home] Navigating to /download with requestId:', requestId);

          this.router.navigate(['/download'], {
            queryParams: {
              requestId,
              url: this.url(),
              quality: this.quality(),
              audioOnly: this.isAudioOnly()
            }
          });
        },
        error: (err) => {
          console.error('[Home] Download API error:', err);
          alert('Failed to start download. Please try again.');
        }
      });
  }

  ngOnDestroy() {
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }
}