import {
  ChangeDetectionStrategy, Component, signal,
  computed, HostListener, ElementRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  platform: 'YouTube' | 'Instagram' | 'TikTok' | 'Facebook';
  likes: string;
  views: string;
  comments: string;
  description: string;
  downloadDate: Date;
  isFavorite: boolean;
  type: 'Video' | 'Audio';
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private el = inject(ElementRef);

  searchQuery        = signal('');
  selectedPlatform   = signal('All Platforms');
  selectedSort       = signal('Recent');
  selectedType       = signal('All Types');
  showFavoritesOnly  = signal(false);

  platforms    = ['All Platforms', 'YouTube', 'Instagram', 'TikTok', 'Facebook'];
  sortOptions  = ['Recent', 'Oldest', 'A-Z'];
  typeOptions  = ['All Types', 'Video', 'Audio'];

  isPlatformDropdownOpen = signal(false);
  isSortDropdownOpen     = signal(false);
  isTypeDropdownOpen     = signal(false);

  // Modal
  selectedVideo = signal<Video | null>(null);

  videos = signal<Video[]>([
    {
      id: '1',
      title: 'Cinematic Masterclass 2024: Advanced Editing Techniques',
      thumbnail: 'https://picsum.photos/seed/vid1/800/450',
      platform: 'YouTube',
      likes: '12.4K',
      views: '1.2M',
      comments: '3.1K',
      description: 'Dive deep into professional video editing workflows. Learn color grading, sound design, and cinematic transitions used by top creators worldwide.',
      downloadDate: new Date('2024-02-20'),
      isFavorite: true,
      type: 'Video'
    },
    {
      id: '2',
      title: 'Summer Vibes - Tropical House Mix',
      thumbnail: 'https://picsum.photos/seed/vid2/800/450',
      platform: 'Instagram',
      likes: '8.2K',
      views: '450K',
      comments: '920',
      description: 'A smooth tropical house mix perfect for beach parties, road trips, or just chilling at home. Features the best summer tracks of the season.',
      downloadDate: new Date('2024-02-25'),
      isFavorite: false,
      type: 'Audio'
    },
    {
      id: '3',
      title: 'Quick Pasta Recipe in 60 Seconds',
      thumbnail: 'https://picsum.photos/seed/vid3/800/450',
      platform: 'TikTok',
      likes: '45K',
      views: '2.8M',
      comments: '8.4K',
      description: 'This ridiculously simple pasta recipe has taken the internet by storm. Only 4 ingredients and 60 seconds stand between you and the perfect meal.',
      downloadDate: new Date('2024-02-26'),
      isFavorite: true,
      type: 'Video'
    },
    {
      id: '4',
      title: 'Tech Review: The Future of AI',
      thumbnail: 'https://picsum.photos/seed/vid4/800/450',
      platform: 'YouTube',
      likes: '5.1K',
      views: '120K',
      comments: '1.2K',
      description: 'An in-depth look at where artificial intelligence is headed in 2025 and beyond. Covering LLMs, robotics, and the societal implications of the AI revolution.',
      downloadDate: new Date('2024-01-15'),
      isFavorite: false,
      type: 'Video'
    },
    {
      id: '5',
      title: 'Morning Motivation Podcast',
      thumbnail: 'https://picsum.photos/seed/vid5/800/450',
      platform: 'Facebook',
      likes: '2.3K',
      views: '89K',
      comments: '340',
      description: 'Start your day right with this energising morning podcast. Topics include mindset, productivity hacks, and stories from successful entrepreneurs.',
      downloadDate: new Date('2024-02-10'),
      isFavorite: false,
      type: 'Audio'
    },
    {
      id: '6',
      title: 'Street Photography Tips',
      thumbnail: 'https://picsum.photos/seed/vid6/800/450',
      platform: 'Instagram',
      likes: '15.7K',
      views: '900K',
      comments: '2.7K',
      description: 'Master the art of candid street photography. Learn how to compose shots, use natural light, and connect with strangers for authentic portraits.',
      downloadDate: new Date('2024-02-27'),
      isFavorite: true,
      type: 'Video'
    }
  ]);

  filteredVideos = computed(() => {
    const result = this.videos().filter(v => {
      const matchesSearch    = v.title.toLowerCase().includes(this.searchQuery().toLowerCase());
      const matchesPlatform  = this.selectedPlatform() === 'All Platforms' || v.platform === this.selectedPlatform();
      const matchesType      = this.selectedType() === 'All Types' || v.type === this.selectedType();
      const matchesFavorite  = !this.showFavoritesOnly() || v.isFavorite;
      return matchesSearch && matchesPlatform && matchesType && matchesFavorite;
    });

    if (this.selectedSort() === 'Recent') {
      result.sort((a, b) => b.downloadDate.getTime() - a.downloadDate.getTime());
    } else if (this.selectedSort() === 'Oldest') {
      result.sort((a, b) => a.downloadDate.getTime() - b.downloadDate.getTime());
    } else if (this.selectedSort() === 'A-Z') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  });

  // ── Close all dropdowns when clicking outside the filter bar ──────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const filterBar = this.el.nativeElement.querySelector('.filter-bar');
    if (filterBar && !filterBar.contains(event.target as Node)) {
      this.closeAllDropdowns();
    }
  }

  closeAllDropdowns() {
    this.isPlatformDropdownOpen.set(false);
    this.isSortDropdownOpen.set(false);
    this.isTypeDropdownOpen.set(false);
  }

  toggleFavorite(id: string) {
    this.videos.update(list =>
      list.map(v => v.id === id ? { ...v, isFavorite: !v.isFavorite } : v)
    );
    // Keep modal in sync
    const cur = this.selectedVideo();
    if (cur && cur.id === id) {
      this.selectedVideo.update(v => v ? { ...v, isFavorite: !v.isFavorite } : null);
    }
  }

  selectPlatform(p: string) { this.selectedPlatform.set(p); this.isPlatformDropdownOpen.set(false); }
  selectSort(s: string)     { this.selectedSort.set(s);     this.isSortDropdownOpen.set(false);     }
  selectType(t: string)     { this.selectedType.set(t);     this.isTypeDropdownOpen.set(false);     }

  openVideo(video: Video)   { this.selectedVideo.set(video); }
  closeModal()              { this.selectedVideo.set(null);  }

  onOverlayClick(event: MouseEvent) {
    // Close only when clicking the dark overlay, not the modal panel itself
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal();
    }
  }
}