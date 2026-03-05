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

@Component({
  selector: 'app-basic-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './basic-dashboard.html',
  // No OnPush — signals handle reactivity automatically
})
export class BasicDashboard implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);

  // ── Signals ──────────────────────────────────────────────────
  profile       = signal<UserProfile | null>(null);
  isLoading     = signal(true);

  // ── Computed from profile signal ──────────────────────────────
  userFirstName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return 'there';
    return ((u.user_metadata?.['full_name'] as string) ?? 'User').split(' ')[0];
  });

  userPlan = computed(() => {
    const p = this.profile();
    if (!p) return 'Free';
    const tier = p.payment_price_id ?? 'free';
    const isActive = p.membership_type === 'monthly' || p.membership_type === 'yearly';
    if (!isActive) return 'Free';
    return tier === 'pro' ? 'Pro' : 'Basic';
  });

  isTrial = computed(() => this.profile()?.is_trial ?? false);

  trialDaysLeft = computed(() => {
    const p = this.profile();
    if (!p?.trial_end) return 0;
    const diff = new Date(p.trial_end).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  // ── Stats (replace driveUsed/cloudUsed with real API when available) ──
  stats = signal({
    totalDownloads: 0,
    totalDriveUploads: 0,
    driveUsed: 0,
    driveTotal: 15,     // GB — standard Google Drive free tier
    cloudUsed: 0,
    cloudTotal: 50,     // GB — Pro personal storage
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

    // Trial expiry warning
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

    // Drive storage warnings
    if (sp >= 95) {
      result.push({
        type: 'danger',
        icon: 'warning',
        message: 'Your Google Drive is almost full. Videos will fail to upload until you free up space.',
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    } else if (sp >= 80) {
      result.push({
        type: 'warn',
        icon: 'cloud_off',
        message: `Your Google Drive is ${sp}% full. Clean it up before uploads start failing.`,
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    }

    // Personal cloud warnings (Pro only)
    if (plan === 'Pro') {
      if (cp >= 95) {
        result.push({
          type: 'danger',
          icon: 'storage',
          message: 'Your personal cloud storage is almost full. New uploads will be blocked.',
        });
      } else if (cp >= 80) {
        result.push({
          type: 'warn',
          icon: 'storage',
          message: `Your personal storage is ${cp}% full. Consider clearing old downloads.`,
        });
      }
    }

    return result;
  });

  // ── History modal ─────────────────────────────────────────────
  isHistoryOpen   = signal(false);
  private historyPage = signal(1);
  private readonly pageSize = 10;

  // ── Download history (replace with real API data) ─────────────
  recentDownloads = signal<DownloadItem[]>([
    { title: 'How to Build a SaaS in 30 Days', thumbnail: 'https://picsum.photos/seed/vid1/80/48', platform: 'YouTube', quality: '1080p', date: 'Today', videoUrl: 'https://youtube.com' },
    { title: 'Lo-fi Hip Hop Mix 2 Hours', thumbnail: 'https://picsum.photos/seed/vid2/80/48', platform: 'YouTube', quality: '720p', date: 'Yesterday', videoUrl: 'https://youtube.com' },
    { title: 'Street Photography Tokyo', thumbnail: 'https://picsum.photos/seed/vid3/80/48', platform: 'Instagram', quality: '1440p', date: 'Mar 1', videoUrl: 'https://instagram.com' },
    { title: 'Next.js 15 Full Course', thumbnail: 'https://picsum.photos/seed/vid4/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 28', videoUrl: 'https://youtube.com' },
    { title: 'Morning Routine Vlog', thumbnail: 'https://picsum.photos/seed/vid5/80/48', platform: 'TikTok', quality: '720p', date: 'Feb 27', videoUrl: 'https://tiktok.com' },
    { title: 'Deep Focus Study Music', thumbnail: 'https://picsum.photos/seed/vid6/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 26', videoUrl: 'https://youtube.com' },
    { title: 'City Timelapse 4K', thumbnail: 'https://picsum.photos/seed/vid7/80/48', platform: 'Vimeo', quality: '4K', date: 'Feb 25', videoUrl: 'https://vimeo.com' },
    { title: 'React State Management Guide', thumbnail: 'https://picsum.photos/seed/vid8/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 24', videoUrl: 'https://youtube.com' },
    { title: 'Minimal Desk Setup Tour', thumbnail: 'https://picsum.photos/seed/vid9/80/48', platform: 'Instagram', quality: '720p', date: 'Feb 23', videoUrl: 'https://instagram.com' },
    { title: 'AI Tools You Should Know', thumbnail: 'https://picsum.photos/seed/vid10/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 22', videoUrl: 'https://youtube.com' },
    { title: 'Barcelona Street Food Tour', thumbnail: 'https://picsum.photos/seed/vid11/80/48', platform: 'YouTube', quality: '1440p', date: 'Feb 21', videoUrl: 'https://youtube.com' },
    { title: 'Figma to Code Workflow', thumbnail: 'https://picsum.photos/seed/vid12/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 20', videoUrl: 'https://youtube.com' },
  ]);

  visibleHistory = computed(() =>
    this.recentDownloads().slice(0, this.pageSize * this.historyPage())
  );

  constructor() {
    // Re-load profile whenever auth user changes
    effect(() => {
      const u = this.auth.currentUser();
      if (u) {
        this.loadProfile();
      } else {
        this.profile.set(null);
        this.isLoading.set(false);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Initial load handled by effect above
  }

  // ── Load profile from DB ──────────────────────────────────────
  private async loadProfile(): Promise<void> {
    this.isLoading.set(true);
    const p = await this.auth.getProfile();
    this.profile.set(p);
    this.isLoading.set(false);

    // TODO: replace with real download stats API call
    // Example shape when you have a downloads table:
    // const { data } = await supabase
    //   .from('downloads')
    //   .select('id, saved_to')
    //   .eq('user_id', user.id);
    // this.stats.set({
    //   totalDownloads: data.length,
    //   totalDriveUploads: data.filter(d => d.saved_to === 'drive').length,
    //   ...
    // });
  }

  // ── Actions ───────────────────────────────────────────────────
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