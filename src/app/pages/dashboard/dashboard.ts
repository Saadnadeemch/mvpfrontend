import { Component, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../services/Models/auth.model';
import { NavbarComponent } from '../../components/navbar/navbar';
import { UserPreferencesService } from '../../services/user-preferences.service';



interface DownloadItem {
  title: string;
  thumbnail: string;
  platform: string;
  quality: string;
  date: string;
  cloud_url: string | null; // strictly Drive URL only
}

interface Stats {
  totalDownloads: number;
  totalDriveUploads: number;
  driveUsed: number;
  driveTotal: number;
}
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

  // State
  profile = signal<UserProfile | null>(null);
  allDownloads = signal<DownloadItem[]>([]);
  stats = signal<Stats>({ totalDownloads: 0, totalDriveUploads: 0, driveUsed: 0, driveTotal: 15 });
  isLoading = signal(true);
  isDownloadsLoading = signal(true);
  isLoadingMore = signal(false);
  readonly cloudUploadEnabled = this.prefs.cloudUploadEnabled
  isHistoryOpen = signal(false);
  private loadedPages = signal(1);

  onThumbnailError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.src = 'default.png'; 
}
  // Computed
  visibleHistory = computed(() => this.allDownloads().slice(0, this.PAGE_SIZE * this.loadedPages()));
  hasMoreHistory = computed(() => this.visibleHistory().length < this.allDownloads().length);
  remaining = computed(() => Math.min(this.PAGE_SIZE, this.allDownloads().length - this.visibleHistory().length));
  recentDownloads = computed(() => this.allDownloads().slice(0, 5));
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
  title: row.title ?? 'Untitled',
  thumbnail: row.thumbnail ?? '',
  platform: row.platform ?? '—',
  quality: row.quality ?? '—',
  date: this.formatDate(row.requested_at),
  cloud_url: row.cloud_url ?? null,   // strictly Drive URL only
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

  // Actions
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