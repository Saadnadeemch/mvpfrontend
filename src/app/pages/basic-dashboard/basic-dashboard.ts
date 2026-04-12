import {
  Component,
  signal,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../services/auth';

interface Alert {
  type: 'warn' | 'danger';
  icon: string;
  message: string;
  action?: string;
  onAction?: () => void;
}

interface DownloadItem {
  title: string;
  thumbnail: string;
  platform: string;
  quality: string;
  date: string;
  videoUrl: string;
}

type UserPlanType = 'Free' | 'Trial' | 'Basic Monthly' | 'Basic Yearly' | 'Advanced Monthly' | 'Advanced Yearly';

@Component({
  selector: 'app-basic-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './basic-dashboard.html',
})
export class BasicDashboard implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);

  profile           = signal<UserProfile | null>(null);
  isLoading         = signal(true);
  isDownloadsLoading = signal(true);

  userFirstName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'there';
    return ((u.user_metadata?.['full_name'] as string) ?? 'User').split(' ')[0];
  });

  userPlan = computed<UserPlanType>(() => {
    const p = this.profile();
    if (!p) return 'Free';

    const now = new Date();
    const trialActive = p.is_trial === true && p.trial_end !== undefined && new Date(p.trial_end) > now;
    const isPaid = p.is_paid === true;

    if (!isPaid && !trialActive) return 'Free';
    if (trialActive && !isPaid) return 'Trial';

    if (isPaid) {
      const plan = p.plan_type ?? 'basic';
      if (plan === 'advanced') {
        return p.membership_type === 'yearly' ? 'Advanced Yearly' : 'Advanced Monthly';
      }
      return p.membership_type === 'yearly' ? 'Basic Yearly' : 'Basic Monthly';
    }

    return 'Free';
  });

  isTrial = computed(() => {
    const p = this.profile();
    if (!p) return false;
    return !!(p.is_trial === true && p.trial_end !== undefined && new Date(p.trial_end) > new Date());
  });

  trialDaysLeft = computed(() => {
    const p = this.profile();
    if (!p?.trial_end) return 0;
    const diff = new Date(p.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  stats = signal({
    totalDownloads: 0,
    totalDriveUploads: 0,
    driveUsed: 0,
    driveTotal: 15,
    cloudUsed: 0,
    cloudTotal: 50,
  });

  storagePercent = computed(() => {
    const s = this.stats();
    if (!s.driveTotal) return 0;
    return Math.round((s.driveUsed / s.driveTotal) * 100);
  });

  cloudPercent = computed(() => {
    const s = this.stats();
    if (!s.cloudTotal) return 0;
    return Math.round((s.cloudUsed / s.cloudTotal) * 100);
  });

  alerts = computed<Alert[]>(() => {
    const result: Alert[] = [];
    const sp = this.storagePercent();
    const cp = this.cloudPercent();
    const daysLeft = this.trialDaysLeft();
    const plan = this.userPlan();

    if (this.isTrial() && daysLeft <= 5) {
      result.push({
        type: daysLeft <= 2 ? 'danger' : 'warn',
        icon: 'schedule',
        message: daysLeft === 0
          ? 'Your free trial has ended. Upgrade to keep access.'
          : `Your free trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        action: 'Upgrade',
        onAction: () => this.router.navigate(['/pricing']),
      });
    }

    if (sp >= 95) {
      result.push({
        type: 'danger', icon: 'warning',
        message: 'Your Google Drive is almost full. Videos will fail to upload until you free up space.',
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    } else if (sp >= 80) {
      result.push({
        type: 'warn', icon: 'cloud_off',
        message: `Your Google Drive is ${sp}% full. Clean it up before uploads start failing.`,
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    }

    const isAdvancedPlan = plan === 'Advanced Monthly' || plan === 'Advanced Yearly';
    if (isAdvancedPlan) {
      if (cp >= 95) {
        result.push({ type: 'danger', icon: 'storage', message: 'Your personal cloud storage is almost full.' });
      } else if (cp >= 80) {
        result.push({ type: 'warn', icon: 'storage', message: `Your personal storage is ${cp}% full.` });
      }
    }

    return result;
  });

  isHistoryOpen    = signal(false);
  private historyPage = signal(1);
  private readonly pageSize = 10;

  recentDownloads = signal<DownloadItem[]>([]);

  visibleHistory = computed(() =>
    this.recentDownloads().slice(0, this.pageSize * this.historyPage())
  );

  constructor() {
    effect(() => {
      const u = this.auth.currentUser();
      if (u) {
        this.loadProfile();
        this.loadDownloads();
      } else {
        this.profile.set(null);
        this.recentDownloads.set([]);
        this.isLoading.set(false);
        this.isDownloadsLoading.set(false);
      }
    });
  }

  async ngOnInit(): Promise<void> {}

private async loadProfile(): Promise<void> {
  this.isLoading.set(true);

  const [p, drive] = await Promise.all([
    this.auth.getProfile(),
    this.auth.getDriveStorage(),
  ]);

  this.profile.set(p);
  this.stats.update(s => ({
    ...s,
    driveUsed:  drive.used_gb,
    driveTotal: drive.total_gb || 15,  // fallback to 15 if Google returns 0
  }));

  this.isLoading.set(false);
}
  
  private async loadDownloads(): Promise<void> {
    this.isDownloadsLoading.set(true);

    const rows = await this.auth.getDownloads();

    // Map DB rows → DownloadItem shape the template expects
    const items: DownloadItem[] = rows.map(row => ({
      title:     row.title     ?? 'Untitled',
      thumbnail: row.thumbnail ?? '',
      platform:  row.platform  ?? '—',
      quality:   row.quality   ?? '—',
      date:      this.formatDate(row.requested_at),
      videoUrl:  row.video_page_url ?? row.cloud_url ?? '#',
    }));

    // Update stats from real data
    const totalDriveUploads = rows.filter(r => !!r.cloud_url).length;
    this.stats.update(s => ({
      ...s,
      totalDownloads: rows.length,
      totalDriveUploads,
    }));

    this.recentDownloads.set(items);
    this.isDownloadsLoading.set(false);

    console.log(`[Dashboard] Loaded ${items.length} downloads | ${totalDriveUploads} uploaded to Drive`);
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '—';

    const date = new Date(iso);
    const now  = new Date();
    const diffMs   = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7)   return `${diffDays} days ago`;

    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  openVideo(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  openHistoryModal(): void {
    this.historyPage.set(1);
    this.isHistoryOpen.set(true);
  }

  closeHistoryModal(): void {
    this.isHistoryOpen.set(false);
  }

  loadMore(): void {
    this.historyPage.update(p => p + 1);
  }
}