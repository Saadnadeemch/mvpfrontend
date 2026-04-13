import {
  Component,
  signal,
  computed,
  effect,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth';

interface DownloadItem {
  title: string;
  thumbnail: string;
  platform: string;
  quality: string;
  date: string;
  videoUrl: string;
}

type UserPlanType =
  | 'Free'
  | 'Trial'
  | 'Basic Monthly'
  | 'Basic Yearly'
  | 'Advanced Monthly'
  | 'Advanced Yearly';

@Component({
  selector: 'app-basic-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './basic-dashboard.html',
  styleUrls: ['./basic-dashboard.css'],
})
export class BasicDashboard implements OnInit, OnDestroy {
  // ── Services ────────────────────────────────────────────────
  private auth = inject(AuthService);
  private router = inject(Router);

  // ── State Signals ───────────────────────────────────────────
  profile = signal<UserProfile | null>(null);
  isLoading = signal(true);
  isDownloadsLoading = signal(true);
  isLoadingMore = signal(false);
  cloudUploadEnabled = signal(true);
  isHistoryOpen = signal(false);

  // ── Pagination ──────────────────────────────────────────────
  private readonly PAGE_SIZE = 20;
  private loadedPages = signal(1);
  allDownloads = signal<DownloadItem[]>([]);

  // ── Stats ───────────────────────────────────────────────────
  stats = signal({
    totalDownloads: 0,
    totalDriveUploads: 0,
    driveUsed: 0,
    driveTotal: 15,
  });

  // ── Computed Values ─────────────────────────────────────────

  /** Visible history based on loaded pages */
  visibleHistory = computed(() =>
    this.allDownloads().slice(0, this.PAGE_SIZE * this.loadedPages())
  );

  /** Check if more items can be loaded */
  hasMoreHistory = computed(
    () => this.visibleHistory().length < this.allDownloads().length
  );

  /** Number of remaining items to load */
  remaining = computed(() =>
    Math.min(
      this.PAGE_SIZE,
      this.allDownloads().length - this.visibleHistory().length
    )
  );

  /** First 5 items for dashboard preview */
  recentDownloads = computed(() => this.allDownloads().slice(0, 5));

  /** Storage percentage */
  storagePercent = computed(() => {
    const s = this.stats();
    return s.driveTotal ? Math.round((s.driveUsed / s.driveTotal) * 100) : 0;
  });

  /** User first name from profile */
  userFirstName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'there';
    const fullName = (u.user_metadata?.['full_name'] as string) ?? 'User';
    return fullName.split(' ')[0];
  });

  /** Trial status */
  isTrial = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return !!(
      p.is_trial === true &&
      p.trial_end !== undefined &&
      new Date(p.trial_end) > new Date()
    );
  });

  /** Trial days remaining */
  trialDaysLeft = computed(() => {
    const p = this.profile();
    if (!p?.trial_end) return 0;
    const diff = new Date(p.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  /** Formatted storage usage string */
  formatStorageUsage = computed(() => {
    const s = this.stats();
    return `${s.driveUsed}GB / ${s.driveTotal}GB`;
  });

  // ── Lifecycle ───────────────────────────────────────────────
  constructor() {
    // Auto-load profile and downloads when user changes
    effect(() => {
      const u = this.auth.currentUser();
      if (u) {
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

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  // ── Data Loading ────────────────────────────────────────────

  /**
   * Load user profile and drive storage stats
   */
  private async loadProfile(): Promise<void> {
    try {
      this.isLoading.set(true);
      const [profile, drive] = await Promise.all([
        this.auth.getProfile(),
        this.auth.getDriveStorage(),
      ]);

      this.profile.set(profile);
      this.stats.update((s) => ({
        ...s,
        driveUsed: drive.used_gb,
        driveTotal: drive.total_gb || 15,
      }));
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Load downloads from API
   */
  private async loadDownloads(): Promise<void> {
    try {
      this.isDownloadsLoading.set(true);
      const rows = await this.auth.getDownloads();

      const items: DownloadItem[] = rows.map((row: any) => ({
        title: row.title ?? 'Untitled',
        thumbnail: row.thumbnail ?? '',
        platform: row.platform ?? '—',
        quality: row.quality ?? '—',
        date: this.formatDate(row.requested_at),
        videoUrl: row.video_page_url ?? row.cloud_url ?? '#',
      }));

      const totalDriveUploads = rows.filter((r: any) => !!r.cloud_url).length;

      this.stats.update((s) => ({
        ...s,
        totalDownloads: rows.length,
        totalDriveUploads,
      }));

      this.allDownloads.set(items);
    } catch (error) {
      console.error('Failed to load downloads:', error);
    } finally {
      this.isDownloadsLoading.set(false);
    }
  }

  // ── Utilities ───────────────────────────────────────────────

  /**
   * Format date string to relative time
   */
  private formatDate(iso: string | null): string {
    if (!iso) return '—';

    const date = new Date(iso);
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  }

  // ── User Actions ────────────────────────────────────────────

  /**
   * Toggle cloud upload setting
   */
  toggleCloudUpload(): void {
    this.cloudUploadEnabled.update((v) => !v);
    // TODO: Persist to backend
  }

  /**
   * Open video in new tab
   */
  openVideo(url: string): void {
    if (url && url !== '#') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Open download history modal
   */
  openHistoryModal(): void {
    this.loadedPages.set(1);
    this.isHistoryOpen.set(true);
  }

  /**
   * Close download history modal
   */
  closeHistoryModal(): void {
    this.isHistoryOpen.set(false);
  }

  /**
   * Load more items in history
   */
  loadMore(): void {
    if (this.isLoadingMore() || !this.hasMoreHistory()) return;

    this.isLoadingMore.set(true);

    // Simulate network delay
    setTimeout(() => {
      this.loadedPages.update((p) => p + 1);
      this.isLoadingMore.set(false);
    }, 300);
  }
}