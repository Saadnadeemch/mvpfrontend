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
import { NavbarComponent } from '../../components/navbar/navbar';
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

  private readonly placeholders = [
    'Paste video URL here...',
    'Download from YouTube, Instagram...',
    'HD quality supported...',
    'Audio only mode available...',
  ];

  readonly qualities = computed<QualityOption[]>(() => {
    const loggedIn = this.authService.isLoggedIn();
    return [
      { label: '240p',  isPaid: false },
      { label: '360p',  isPaid: false },
      { label: '480p',  isPaid: false },
      { label: '720p',  isPaid: false },
      { label: '1080p', isPaid: !loggedIn },
      { label: '1440p', isPaid: !loggedIn },
      { label: '2160p', isPaid: !loggedIn },
      { label: '4K',    isPaid: !loggedIn },
    ];
  });

  constructor() {
    this.startTypewriter();
  }

  private startTypewriter() {
    let charIndex = 0;
    let isDeleting = false;

    const getTypingDelay = (char: string, deleting: boolean): number => {
      if (deleting) return 35 + Math.random() * 15;
      if (['.', ',', '!', '?'].includes(char)) return 180;
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
    if (this.isAudioOnly()) {
      this.isDropdownOpen.set(false);
    }
  }

  toggleDropdown(event: MouseEvent) {
    event.stopPropagation();
    if (this.isAudioOnly()) return;
    this.isDropdownOpen.update(v => !v);
  }

  selectQuality(option: QualityOption) {
    if (option.isPaid) return;
    this.quality.set(option.label);
    this.isDropdownOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.isDropdownOpen.set(false);
  }

  async handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        this.url.set(text.trim());
        this.handleDownload();
      }
    } catch {
      // clipboard access denied — user can paste manually
    }
  }

onPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text')?.trim();
  if (!text) return;
  this.url.set(text);
  setTimeout(() => this.handleDownload(), 0);
}
  handleDownload() {
    if (!this.url().trim() || this.isDownloading()) return;

    this.audioService.unlock();
    this.isDownloading.set(true);

    const token = this.authService.currentSession()?.access_token ?? '';
    const payload = {
      url: this.url(),
      quality: this.quality(),
      audioOnly: this.isAudioOnly(),
      cloudUpload: this.prefs.cloudUploadEnabled(),
    };

    this.downloadSvc
      .createDownload(payload, token)
      .pipe(finalize(() => this.isDownloading.set(false)))
      .subscribe({
        next: (res) => {
          // console.log('[Home] Server response:', res);
          const requestId = res.request_id;
          if (!requestId) {
            alert('Server did not return a valid request ID.');
            return;
          }

          this.navState.setVideoInfo(res.video_info ?? null);
          this.router.navigate(['/download'], {
            queryParams: {
              requestId,
              url: this.url(),
              quality: this.quality(),
              audioOnly: this.isAudioOnly(),
            }
          });
        },
        error: () => {
          alert('Failed to start download. Please try again.');
        },
      });
  }

  ngOnDestroy() {
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
  }
}