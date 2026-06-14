import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DownloadService } from '../../services/download';
import { NavigationStateService } from '../../services/navigationsate';
import { finalize } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Footer } from '../../components/footer/footer';
import { NavbarComponent } from "../../components/navbar/navbar";
import { UserPreferencesService } from '../../services/user-preferences.service';
import { Playaudio } from '../../services/playaudio';

interface QualityOption {
  label: string;
  isPaid: boolean;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, Footer, MatIconModule, NavbarComponent],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Home implements OnDestroy {

  private router = inject(Router);
  private downloadSvc = inject(DownloadService);
  private navState = inject(NavigationStateService);
  private authService = inject(AuthService);
  private audioService = inject(Playaudio);
  private prefs = inject(UserPreferencesService);

  url = signal('');
  isAudioOnly = signal(false);
  quality = signal('720p');
  isDownloading = signal(false);
  isDropdownOpen = signal(false);
  placeholderText = signal('');

  private currentPlaceholderIndex = signal(0);
  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  readonly qualities = computed<QualityOption[]>(() => {
    const loggedIn = this.authService.isLoggedIn();
    console.log('[Home] Computing qualities list - User logged in:', loggedIn);
    return [
      { label: '240p', isPaid: false },
      { label: '360p', isPaid: false },
      { label: '480p', isPaid: false },
      { label: '720p', isPaid: false },
      { label: '1080p', isPaid: !loggedIn },
      { label: '1440p', isPaid: !loggedIn },
      { label: '2160p', isPaid: !loggedIn },
      { label: '4K', isPaid: !loggedIn },
    ];
  });

  private placeholders = [
    'Paste video URL here...',
    'Download from YouTube, Instagram...',
    'HD quality supported...',
    'Audio only mode available...',
  ];

  constructor() {
    this.startTypewriter();
  }

  isQualityAllowed(q: QualityOption): boolean {
    const loggedIn = this.authService.isLoggedIn();
    const allowed = loggedIn || !q.isPaid;
    return allowed;
  }

  private startTypewriter() {
    let charIndex = 0;
    let isDeleting = false;

    const getTypingDelay = (char: string, deleting: boolean) => {
      if (deleting) {
        return 35 + Math.random() * 15;
      }

      if (['.', ',', '!', '?'].includes(char)) {
        return 180;
      }

      return 50 + Math.random() * 40;
    };

    const tick = () => {
      const fullText = this.placeholders[this.currentPlaceholderIndex()];

      charIndex = isDeleting ? charIndex - 1 : charIndex + 1;

      this.placeholderText.set(fullText.substring(0, charIndex));

      let delay = getTypingDelay(fullText[charIndex] || '', isDeleting);

      if (!isDeleting && charIndex === fullText.length) {
        isDeleting = true;
        delay = 1800;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        this.currentPlaceholderIndex.update(i => (i + 1) % this.placeholders.length);
        delay = 400;
      }

      this.typingTimer = setTimeout(tick, delay);
    };

    tick();
  }

  toggleAudio() {
    this.isAudioOnly.update(v => !v);
    console.log('[Home] Audio toggle - isAudioOnly:', this.isAudioOnly());
    if (this.isAudioOnly()) {
      console.log('[Home] Audio-only enabled, closing quality dropdown');
      this.isDropdownOpen.set(false);
    }
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    console.log('[Home] Toggle dropdown clicked');
    if (this.isAudioOnly()) {
      console.log('[Home] Audio-only mode active, dropdown toggle ignored');
      return;
    }
    this.isDropdownOpen.update(v => !v);
    console.log('[Home] Dropdown state:', this.isDropdownOpen());
  }

  selectQuality(option: QualityOption) {
    console.log('[Home] Quality selection attempted:', option.label);
    if (option.isPaid) {
      console.log('[Home] Quality is paid, selection ignored');
      return;
    }
    this.quality.set(option.label);
    this.isDropdownOpen.set(false);
    console.log('[Home] Quality selected:', option.label);
  }

  @HostListener('document:click')
  onDocumentClick() {
    console.log('[Home] Document click detected, closing dropdown');
    this.isDropdownOpen.set(false);
  }

  async handlePaste() {
    console.log('[Home] Handling paste action');
    try {
      const text = await navigator.clipboard.readText();
      console.log('[Home] Clipboard text retrieved, length:', text?.length);
      if (text?.trim()) {
        this.url.set(text.trim());
        console.log('[Home] URL set from clipboard:', text.trim().substring(0, 50) + '...');
        this.handleDownload();
      }
    } catch (error) {
      console.warn('[Home] Clipboard access failed:', error);
    }
  }

  handleDownload() {
    console.log('[Home] Download handler initiated');
    if (!this.url().trim()) {
      console.warn('[Home] URL is empty, download cancelled');
      return;
    }
    if (this.isDownloading()) {
      console.warn('[Home] Download already in progress, request ignored');
      return;
    }

    this.audioService.unlock();
    this.isDownloading.set(true);
    console.log('[Home] Download started for URL:', this.url().substring(0, 50) + '...');

    const token = this.authService.currentSession()?.access_token ?? '';
    console.log('[Home] Auth token present:', !!token);

    const payload = {
      url: this.url(),
      quality: this.quality(),
      audioOnly: this.isAudioOnly(),
      cloudUpload: this.prefs.cloudUploadEnabled(),
    };

    console.log('[Home] Download payload:', payload);

    this.downloadSvc
      .createDownload(payload, token)
      .pipe(finalize(() => {
        console.log('[Home] Download request finalized');
        this.isDownloading.set(false);
      }))
      .subscribe({
        next: (res) => {
          console.log('[Home] Download creation successful, response:', res);
          const requestId = res.request_id;
          if (!requestId) {
            console.error('[Home] Server response missing request_id');
            alert('Server did not return a valid request ID.');
            return;
          }

          console.log('[Home] Request ID received:', requestId);
          this.navState.setVideoInfo(res.video_info ?? null);
          console.log('[Home] Video info set in navigation state');

          console.log('[Home] Navigating to download page with query params');
          this.router.navigate(['/download'], {
            queryParams: {
              requestId,
              url: this.url(),
              quality: this.quality(),
              audioOnly: this.isAudioOnly(),
            }
          });
        },
        error: (error) => {
          console.error('[Home] Download creation failed:', error);
          alert('Failed to start download. Please try again.');
        },
      });
  }

  ngOnDestroy() {
    console.log('[Home] Component destroyed');
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
      console.log('[Home] Typing timer cleared');
    }
  }
}
