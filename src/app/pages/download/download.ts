import {
  ChangeDetectionStrategy, Component, signal,
  OnInit, OnDestroy, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

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

    /* Faint track outline — always visible */
    .svg-track-rect {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 3;
      opacity: 0.15;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Progress stroke — ease-in-out so every tick glides smoothly */
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

  progress    = signal(0);
  isCompleted = signal(false);

  videoData = {
    thumbnail:    'https://picsum.photos/seed/video/800/450',
    title:        'How to Edit Like a Pro: Cinematic Masterclass 2024',
    description:  'Learn the secrets of professional video editing in this comprehensive guide. We cover everything from color grading to sound design...',
    likes:        '12.4K',
    comments:     '842',
    views:        '1.2M',
    requestedUrl: ''
  };

  private timer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.videoData.requestedUrl =
      this.route.snapshot.queryParams['url'] || 'https://youtube.com/watch?v=example';
    this.startSimulation();
  }

  private startSimulation() {
    let current = 0;
    // Tick every 600ms — the CSS transition handles all the visual smoothing
    this.timer = setInterval(() => {
      current = Math.min(100, current + Math.random() * 4 + 1);
      this.progress.set(Math.round(current));

      if (current >= 100) {
        clearInterval(this.timer!);
        this.timer = null;
        this.isCompleted.set(true);
      }
    }, 600);
  }

  saveVideo() {
    alert('Saving video to your device...');
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}