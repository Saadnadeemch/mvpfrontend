import {ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {ActivatedRoute} from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-download',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './download.html',
  styles: [`
    .border-loader {
      position: absolute;
      inset: -2px;
      border: 4px solid transparent;
      border-radius: 1rem;
      pointer-events: none;
      z-index: 10;
    }
    
    .loader-path {
      position: absolute;
      inset: -4px;
      border: 4px solid var(--color-primary);
      border-radius: 1.25rem;
      clip-path: inset(0 0 100% 0);
      transition: clip-path 0.3s ease-out;
    }
    
    /* SVG Border Animation */
    .svg-border-container {
      position: absolute;
      inset: -2px;
      width: calc(100% + 4px);
      height: calc(100% + 4px);
      pointer-events: none;
    }
    
    .svg-border-rect {
      fill: none;
      stroke: #3c6e71;
      stroke-width: 4;
      stroke-dasharray: 1;
      stroke-dashoffset: 1;
      transition: stroke-dashoffset 0.1s linear;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `]
})
export class Download implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  progress = signal(0);
  isCompleted = signal(false);
  
  videoData = {
    thumbnail: 'https://picsum.photos/seed/video/800/450',
    title: 'How to Edit Like a Pro: Cinematic Masterclass 2024',
    description: 'Learn the secrets of professional video editing in this comprehensive guide. We cover everything from color grading to sound design...',
    likes: '12.4K',
    comments: '842',
    views: '1.2M',
    requestedUrl: ''
  };

  private progressInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.videoData.requestedUrl = this.route.snapshot.queryParams['url'] || 'https://youtube.com/watch?v=example';
    this.startSimulation();
  }

  private startSimulation() {
    let current = 0;
    this.progressInterval = setInterval(() => {
      // Smaller increments for smoother feel
      const increment = Math.random() * 2 + 0.5;
      current = Math.min(100, current + increment);
      this.progress.set(Math.floor(current));
      
      if (current >= 100 && this.progressInterval) {
        clearInterval(this.progressInterval);
        this.isCompleted.set(true);
      }
    }, 100);
  }

  saveVideo() {
    alert('Saving video to your device...');
  }

  ngOnDestroy() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
  }
}
