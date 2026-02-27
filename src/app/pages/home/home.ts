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

  url = signal('');
  isAudioOnly = signal(false);
  quality = signal('720p');
  isDownloading = signal(false);
  isDropdownOpen = signal(false);

  qualities: QualityOption[] = [
    { label: '240p', isPaid: false },
    { label: '360p', isPaid: false },
    { label: '480p', isPaid: false },
    { label: '720p', isPaid: false },
    { label: '1080p', isPaid: true },
    { label: '1440p', isPaid: true },
    { label: '2080p', isPaid: true },
    { label: '4K', isPaid: true }
  ];

  private placeholders = [
    'Paste video URL here...',
    'Download from YouTube, Instagram...',
    'HD quality support...',
    'Audio only mode available...'
  ];

  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  currentPlaceholderIndex = signal(0);
  placeholderText = signal('');

  constructor() {
    this.startTypewriter();
  }

  private startTypewriter() {
    let charIndex = 0;
    let isDeleting = false;

    const type = () => {
      const fullText = this.placeholders[this.currentPlaceholderIndex()];

      if (isDeleting) {
        charIndex--;
      } else {
        charIndex++;
      }

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

  handleDownload() {
    if (!this.url().trim()) return;

    this.isDownloading.set(true);

    setTimeout(() => {
      this.isDownloading.set(false);
      this.router.navigate(['/download'], {
        queryParams: {
          url: this.url(),
          quality: this.quality(),
          audioOnly: this.isAudioOnly()
        }
      });
    }, 1500);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.quality-dropdown-container')) {
      this.isDropdownOpen.set(false);
    }
  }

  ngOnDestroy() {
    if (this.typingTimer) clearTimeout(this.typingTimer);
  }
}