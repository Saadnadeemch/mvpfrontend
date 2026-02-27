import {ChangeDetectionStrategy, Component, signal, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatIconModule} from '@angular/material/icon';

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  platform: 'YouTube' | 'Instagram' | 'TikTok' | 'Facebook';
  likes: string;
  views: string;
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
  searchQuery = signal('');
  selectedPlatform = signal('All Platforms');
  selectedSort = signal('Recent');
  selectedType = signal('All Types');
  showFavoritesOnly = signal(false);

  platforms = ['All Platforms', 'YouTube', 'Instagram', 'TikTok', 'Facebook'];
  sortOptions = ['Recent', 'Oldest', 'A-Z'];
  typeOptions = ['All Types', 'Video', 'Audio'];

  isPlatformDropdownOpen = signal(false);
  isSortDropdownOpen = signal(false);
  isTypeDropdownOpen = signal(false);

  videos = signal<Video[]>([
    {
      id: '1',
      title: 'Cinematic Masterclass 2024: Advanced Editing Techniques',
      thumbnail: 'https://picsum.photos/seed/vid1/400/225',
      platform: 'YouTube',
      likes: '12.4K',
      views: '1.2M',
      downloadDate: new Date('2024-02-20'),
      isFavorite: true,
      type: 'Video'
    },
    {
      id: '2',
      title: 'Summer Vibes - Tropical House Mix',
      thumbnail: 'https://picsum.photos/seed/vid2/400/225',
      platform: 'Instagram',
      likes: '8.2K',
      views: '450K',
      downloadDate: new Date('2024-02-25'),
      isFavorite: false,
      type: 'Audio'
    },
    {
      id: '3',
      title: 'Quick Pasta Recipe in 60 Seconds',
      thumbnail: 'https://picsum.photos/seed/vid3/400/225',
      platform: 'TikTok',
      likes: '45K',
      views: '2.8M',
      downloadDate: new Date('2024-02-26'),
      isFavorite: true,
      type: 'Video'
    },
    {
      id: '4',
      title: 'Tech Review: The Future of AI',
      thumbnail: 'https://picsum.photos/seed/vid4/400/225',
      platform: 'YouTube',
      likes: '5.1K',
      views: '120K',
      downloadDate: new Date('2024-01-15'),
      isFavorite: false,
      type: 'Video'
    },
    {
      id: '5',
      title: 'Morning Motivation Podcast',
      thumbnail: 'https://picsum.photos/seed/vid5/400/225',
      platform: 'Facebook',
      likes: '2.3K',
      views: '89K',
      downloadDate: new Date('2024-02-10'),
      isFavorite: false,
      type: 'Audio'
    },
    {
      id: '6',
      title: 'Street Photography Tips',
      thumbnail: 'https://picsum.photos/seed/vid6/400/225',
      platform: 'Instagram',
      likes: '15.7K',
      views: '900K',
      downloadDate: new Date('2024-02-27'),
      isFavorite: true,
      type: 'Video'
    }
  ]);

  filteredVideos = computed(() => {
    const result = this.videos().filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(this.searchQuery().toLowerCase());
      const matchesPlatform = this.selectedPlatform() === 'All Platforms' || v.platform === this.selectedPlatform();
      const matchesType = this.selectedType() === 'All Types' || v.type === this.selectedType();
      const matchesFavorite = !this.showFavoritesOnly() || v.isFavorite;
      return matchesSearch && matchesPlatform && matchesType && matchesFavorite;
    });

    // Sorting
    if (this.selectedSort() === 'Recent') {
      result.sort((a, b) => b.downloadDate.getTime() - a.downloadDate.getTime());
    } else if (this.selectedSort() === 'Oldest') {
      result.sort((a, b) => a.downloadDate.getTime() - b.downloadDate.getTime());
    } else if (this.selectedSort() === 'A-Z') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  });

  toggleFavorite(id: string) {
    this.videos.update(list => list.map(v => v.id === id ? {...v, isFavorite: !v.isFavorite} : v));
  }

  selectPlatform(p: string) {
    this.selectedPlatform.set(p);
    this.isPlatformDropdownOpen.set(false);
  }

  selectSort(s: string) {
    this.selectedSort.set(s);
    this.isSortDropdownOpen.set(false);
  }

  selectType(t: string) {
    this.selectedType.set(t);
    this.isTypeDropdownOpen.set(false);
  }

  closeAllDropdowns() {
    this.isPlatformDropdownOpen.set(false);
    this.isSortDropdownOpen.set(false);
    this.isTypeDropdownOpen.set(false);
  }
}