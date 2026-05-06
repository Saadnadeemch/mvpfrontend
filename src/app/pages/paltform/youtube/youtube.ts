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
import { Footer } from '../../../components/footer/footer';
import { NavbarComponent } from '../../../components/navbar/navbar';
import { DownloadService } from '../../../services/download';
import { NavigationStateService } from '../../../services/navigationsate';
import { AuthService } from '../../../services/auth.service';
import { Playaudio } from '../../../services/playaudio';
import { UserPreferencesService } from '../../../services/user-preferences.service';
import { finalize } from 'rxjs';

interface QualityOption {
  label: string;
  isPaid: boolean;
}

@Component({
  selector: 'app-youtube',
  imports: [CommonModule, FormsModule, Footer, MatIconModule, NavbarComponent],
  templateUrl: './youtube.html',
  styleUrl: './youtube.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Youtube implements OnDestroy {

  // ── Services ────────────────────────────────────────────────────────────
  private router      = inject(Router);
  private downloadSvc = inject(DownloadService);
  private navState    = inject(NavigationStateService);
  private authService = inject(AuthService);
  private audioService = inject(Playaudio)
  private prefs = inject(UserPreferencesService);

  // ── State ────────────────────────────────────────────────────────────────
  url             = signal('');
  isAudioOnly     = signal(false);
  quality         = signal('720p');
  isDownloading   = signal(false);
  isDropdownOpen  = signal(false);
  placeholderText = signal('');

  private currentPlaceholderIndex = signal(0);
  private typingTimer: ReturnType<typeof setTimeout> | null = null;


  // Remove the static qualities array and replace with:
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

private placeholders = [
  'Paste YouTube URL...',
  'Download in 720p, 1080p, 4K...',
  'Save Shorts instantly...',
  'Audio (MP3) only...',
  'All formats supported...',
];

  constructor() {
    this.startTypewriter();
  }

  isQualityAllowed(q: QualityOption): boolean {
  if (this.authService.isLoggedIn()) return true;   
  return !q.isPaid;                                  
}

  // ── Typewriter Effect ────────────────────────────────────────────────────
 private startTypewriter() {
  let charIndex = 0;
  let isDeleting = false;

  const getTypingDelay = (char: string, deleting: boolean) => {
    if (deleting) {
      return 35 + Math.random() * 15; // smooth, not too fast
    }

    // slight pause on punctuation
    if (['.', ',', '!', '?'].includes(char)) {
      return 180;
    }

    // natural typing variation
    return 50 + Math.random() * 40;
  };

  const tick = () => {
    const fullText = this.placeholders[this.currentPlaceholderIndex()];

    charIndex = isDeleting ? charIndex - 1 : charIndex + 1;

    this.placeholderText.set(fullText.substring(0, charIndex));

    let delay = getTypingDelay(fullText[charIndex] || '', isDeleting);

    // finished typing
    if (!isDeleting && charIndex === fullText.length) {
      isDeleting = true;
      delay = 1800; // pause before delete
    }

    // finished deleting
    else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      this.currentPlaceholderIndex.update(i => (i + 1) % this.placeholders.length);
      delay = 400; // short pause before next word
    }

    this.typingTimer = setTimeout(tick, delay);
  };

  tick();
}
  // ── Audio Toggle ─────────────────────────────────────────────────────────
  toggleAudio() {
    this.isAudioOnly.update(v => !v);
    // close quality dropdown when switching to audio-only
    if (this.isAudioOnly()) this.isDropdownOpen.set(false);
  }

  // ── Quality Dropdown ─────────────────────────────────────────────────────
  /**
   * FIX: stopPropagation prevents the HostListener below from
   * immediately closing the dropdown on the same click event.
   */
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

  /** Close dropdown when clicking anywhere outside it. */
  @HostListener('document:click')
  onDocumentClick() {
    this.isDropdownOpen.set(false);
  }

  // ── Paste & Download ─────────────────────────────────────────────────────
  /**
   * Reads the clipboard, fills the URL input, then immediately
   * triggers the download — replaces the old send button.
   */
  async handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        this.url.set(text.trim());
        this.handleDownload();
      }
    } catch {
      // Clipboard permission denied — silently ignore
    }
  }

  handleDownload() {
    if (!this.url().trim() || this.isDownloading()) return;
    this.audioService.unlock();
    this.isDownloading.set(true);

    const token = this.authService.currentSession()?.access_token ?? '';

    const payload = {
      url:         this.url(),
      quality:     this.quality(),
      audioOnly:   this.isAudioOnly(),
      cloudUpload: this.prefs.cloudUploadEnabled(),
    };

    this.downloadSvc
      .createDownload(payload, token)
      .pipe(finalize(() => this.isDownloading.set(false)))
      .subscribe({
        next: (res) => {
          const requestId = res.request_id;
          if (!requestId) {
            alert('Server did not return a valid request ID.');
            return;
          }

          this.navState.setVideoInfo(res.video_info ?? null);

          this.router.navigate(['/download'], {
            queryParams: {
              requestId,
              url:       this.url(),
              quality:   this.quality(),
              audioOnly: this.isAudioOnly(),
            }
          });
        },
        error: () => alert('Failed to start download. Please try again.'),
      });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnDestroy() {
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }
}

















