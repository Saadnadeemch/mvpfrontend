import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../services/Models/auth.model';
import { NavbarComponent } from '../../components/navbar/navbar';
import { UserPreferencesService } from '../../services/user-preferences.service';


interface DownloadItem {
  id: string;
  title: string;
  thumbnail: string;
  platform: string;
  quality: string;
  date: string;
  cloud_url: string | null;
  audio_only: boolean;
  video_type: string | null;
  requested_at: string | null;
}

interface Stats {
  totalDownloads: number;
  totalDriveUploads: number;
  driveUsed: number;
  driveTotal: number;
}

export type DateFilter = 'all' | 'today' | 'yesterday' | '7d' | '14d' | '30d';
export type MediaFilter = 'all' | 'video' | 'audio';
export type VideoTypeFilter = 'all' | 'video' | 'reel';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private auth = inject(AuthService);
  private prefs = inject(UserPreferencesService);
  private router = inject(Router);

  readonly PAGE_SIZE = 20;

  // ── Core state ──────────────────────────────────────────────────────────────
  profile = signal<UserProfile | null>(null);
  allDownloads = signal<DownloadItem[]>([]);
  stats = signal<Stats>({ totalDownloads: 0, totalDriveUploads: 0, driveUsed: 0, driveTotal: 15 });
  isLoading = signal(true);
  isDownloadsLoading = signal(true);
  isLoadingMore = signal(false);
  readonly cloudUploadEnabled = this.prefs.cloudUploadEnabled;
  isHistoryOpen = signal(false);
  private loadedPages = signal(1);

  // ── Filter state ─────────────────────────────────────────────────────────────
  isFilterOpen = signal(false);
  filterDate = signal<DateFilter>('all');
  filterMedia = signal<MediaFilter>('all');
  filterVideoType = signal<VideoTypeFilter>('all');
  filterPlatform = signal<string>('all');
  filterQuality = signal<string>('all');

  // Only one dropdown open at a time
  openDropdown = signal<string | null>(null);

  // ── Computed: unique filter options from loaded data ─────────────────────────
  platformOptions = computed(() => [
    ...new Set(
      this.allDownloads()
        .map(d => d.platform)
        .filter(p => p && p !== '—')
    )
  ]);

  qualityOptions = computed(() => [
    ...new Set(
      this.allDownloads()
        .map(d => d.quality)
        .filter(q => q && q !== '—')
    )
  ]);

  // ── Computed: active filter count ────────────────────────────────────────────
  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterDate() !== 'all') count++;
    if (this.filterMedia() !== 'all') count++;
    if (this.filterVideoType() !== 'all') count++;
    if (this.filterPlatform() !== 'all') count++;
    if (this.filterQuality() !== 'all') count++;
    return count;
  });

  // ── Computed: filtered downloads ─────────────────────────────────────────────
  filteredDownloads = computed(() => {
    let items = this.allDownloads();

    // Date filter
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();

    switch (this.filterDate()) {
      case 'today':
        items = items.filter(d => d.requested_at && new Date(d.requested_at).getTime() >= todayMs);
        break;
      case 'yesterday':
        items = items.filter(d => {
          if (!d.requested_at) return false;
          const t = new Date(d.requested_at).getTime();
          return t >= todayMs - 86_400_000 && t < todayMs;
        });
        break;
      case '7d':
        items = items.filter(d => d.requested_at && new Date(d.requested_at).getTime() >= now - 7 * 86_400_000);
        break;
      case '14d':
        items = items.filter(d => d.requested_at && new Date(d.requested_at).getTime() >= now - 14 * 86_400_000);
        break;
      case '30d':
        items = items.filter(d => d.requested_at && new Date(d.requested_at).getTime() >= now - 30 * 86_400_000);
        break;
    }

    // Media filter
    if (this.filterMedia() === 'audio') {
      items = items.filter(d => d.audio_only);
    } else if (this.filterMedia() === 'video') {
      items = items.filter(d => !d.audio_only);
    }

    // Video type filter — normalize both sides to lowercase to avoid case mismatch
    if (this.filterVideoType() !== 'all') {
      const target = this.filterVideoType().toLowerCase();
      items = items.filter(d => d.video_type?.toLowerCase() === target);
    }

    // Platform filter
    if (this.filterPlatform() !== 'all') {
      items = items.filter(d => d.platform === this.filterPlatform());
    }

    // Quality filter
    if (this.filterQuality() !== 'all') {
      items = items.filter(d => d.quality === this.filterQuality());
    }

    return items;
  });

  // Recent = first 5 of filtered
  recentDownloads = computed(() => this.filteredDownloads().slice(0, 5));

  // History modal uses filtered too
  visibleHistory = computed(() => this.filteredDownloads().slice(0, this.PAGE_SIZE * this.loadedPages()));
  hasMoreHistory = computed(() => this.visibleHistory().length < this.filteredDownloads().length);
  remaining = computed(() => Math.min(this.PAGE_SIZE, this.filteredDownloads().length - this.visibleHistory().length));

  // ── User / profile computed ──────────────────────────────────────────────────
  storagePercent = computed(() => {
    const { driveUsed, driveTotal } = this.stats();
    return driveTotal ? Math.round((driveUsed / driveTotal) * 100) : 0;
  });

  formatStorageUsage = computed(() => {
    const { driveUsed, driveTotal } = this.stats();
    return `${driveUsed}GB / ${driveTotal}GB`;
  });

  userFirstName = computed(() => {
    const user = this.auth.currentUser();
    const fullName = (user?.user_metadata?.['full_name'] as string) ?? 'User';
    return user ? fullName.split(' ')[0] : 'there';
  });

  isTrial = computed(() => {
    const p = this.profile();
    return !!(p?.is_trial && p?.trial_end && new Date(p.trial_end) > new Date());
  });

  trialDaysLeft = computed(() => {
    const trialEnd = this.profile()?.trial_end;
    if (!trialEnd) return 0;
    return Math.max(0, Math.ceil((new Date(trialEnd).getTime() - Date.now()) / 86_400_000));
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      if (this.auth.currentUser()) {
        this.loadProfile();
        this.loadDownloads();
      } else {
        this.profile.set(null);
        this.allDownloads.set([]);
        this.isLoading.set(false);
        this.isDownloadsLoading.set(false);
      }
    });
  }

  // ── Data loading ─────────────────────────────────────────────────────────────
  private async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [profile, drive] = await Promise.all([
        this.auth.getProfile(),
        this.auth.getDriveStorage(),
      ]);
      this.profile.set(profile);
      this.stats.update(s => ({ ...s, driveUsed: drive.used_gb, driveTotal: drive.total_gb || 15 }));
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async loadDownloads(): Promise<void> {
    this.isDownloadsLoading.set(true);
    try {
      const rows = await this.auth.getDownloads();

      const items: DownloadItem[] = rows.map((row: any) => ({
        id: row.id,
        title: row.title ?? 'Untitled',
        thumbnail: row.thumbnail ?? '',
        platform: row.platform ?? '—',
        quality: row.quality ?? '—',
        date: this.formatDate(row.requested_at),
        cloud_url: row.cloud_url ?? null,
        audio_only: row.audio_only ?? false,
        video_type: row.video_type ?? null,
        requested_at: row.requested_at ?? null,
      }));

      this.allDownloads.set(items);
      this.stats.update(s => ({
        ...s,
        totalDownloads: rows.length,
        totalDriveUploads: rows.filter((r: any) => !!r.cloud_url).length,
      }));
    } catch (e) {
      console.error('Failed to load downloads:', e);
    } finally {
      this.isDownloadsLoading.set(false);
    }
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ── Filter actions ───────────────────────────────────────────────────────────
  toggleFilterBar(): void {
    this.isFilterOpen.update(v => !v);
    this.openDropdown.set(null);
  }

  toggleDropdown(name: string): void {
    this.openDropdown.update(v => v === name ? null : name);
  }

  setFilterDate(v: DateFilter): void {
    this.filterDate.set(v);
    this.openDropdown.set(null);
  }

  setFilterMedia(v: MediaFilter): void {
    this.filterMedia.set(v);
    this.openDropdown.set(null);
  }

  setFilterVideoType(v: VideoTypeFilter): void {
    this.filterVideoType.set(v);
    this.openDropdown.set(null);
  }

  setFilterPlatform(v: string): void {
    this.filterPlatform.set(v);
    this.openDropdown.set(null);
  }

  setFilterQuality(v: string): void {
    this.filterQuality.set(v);
    this.openDropdown.set(null);
  }

  clearFilters(): void {
    this.filterDate.set('all');
    this.filterMedia.set('all');
    this.filterVideoType.set('all');
    this.filterPlatform.set('all');
    this.filterQuality.set('all');
    this.openDropdown.set(null);
  }

  // ── Helper: date filter label ────────────────────────────────────────────────
  getDateFilterLabel(): string {
    const map: Record<DateFilter, string> = {
      all: 'Date', today: 'Today', yesterday: 'Yesterday',
      '7d': 'Last 7 days', '14d': 'Last 14 days', '30d': 'Last month'
    };
    return map[this.filterDate()];
  }

  // ── Other actions ────────────────────────────────────────────────────────────
  onThumbnailError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'default.png';
  }

  toggleCloudUpload(): void {
    this.cloudUploadEnabled.update(v => !v);
  }

  openVideo(url: string | null): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openHistoryModal(): void {
    this.loadedPages.set(1);
    this.isHistoryOpen.set(true);
  }

  closeHistoryModal(): void {
    this.isHistoryOpen.set(false);
  }

  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMoreHistory()) return;
    this.isLoadingMore.set(true);
    setTimeout(() => {
      this.loadedPages.update(p => p + 1);
      this.isLoadingMore.set(false);
    }, 300);
  }
}