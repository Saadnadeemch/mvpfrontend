import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

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
  savedTo: 'drive' | 'cloud';
}

@Component({
  selector: 'app-basic-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './basic-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BasicDashboard implements OnInit {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private cdr    = inject(ChangeDetectorRef);

  // Plain properties — updated by effect() so OnPush re-renders
  userFirstName = 'there';
  userPlan: 'Free' | 'Basic' | 'Pro' = 'Basic';

  constructor() {
    effect(() => {
      const u = this.auth.currentUser();
      this.userFirstName = u
        ? ((u.user_metadata?.['full_name'] as string) ?? 'User').split(' ')[0]
        : 'there';
      this.userPlan = this.auth.isPaid() ? 'Pro' : 'Basic';
      this.buildAlerts();
      this.cdr.markForCheck();
    });
  }

  // ── Stats (replace with real API data) ──
  stats = {
    totalDownloads: 142,
    thisMonth: 23,
    driveUsed: 12.4,
    driveTotal: 15,
    cloudUsed: 18.7,
    cloudTotal: 50,
  };

  get storagePercent(): number {
    return Math.round((this.stats.driveUsed / this.stats.driveTotal) * 100);
  }

  get cloudPercent(): number {
    return Math.round((this.stats.cloudUsed / this.stats.cloudTotal) * 100);
  }

  alerts: Alert[] = [];

  // ── History modal ──
  isHistoryOpen = false;
  private historyPage = 1;
  private readonly pageSize = 10;

  get visibleHistory(): DownloadItem[] {
    return this.recentDownloads.slice(0, this.pageSize * this.historyPage);
  }

  openHistoryModal(): void {
    this.historyPage = 1;
    this.isHistoryOpen = true;
    this.cdr.markForCheck();
  }

  closeHistoryModal(): void {
    this.isHistoryOpen = false;
    this.cdr.markForCheck();
  }

  loadMore(): void {
    this.historyPage++;
    this.cdr.markForCheck();
  }

  // ── Replace with real API data ──
  recentDownloads: DownloadItem[] = [
    { title: 'How to Build a SaaS in 30 Days', thumbnail: 'https://picsum.photos/seed/vid1/80/48', platform: 'YouTube', quality: '1080p', date: 'Today', savedTo: 'drive' },
    { title: 'Lo-fi Hip Hop Mix 2 Hours', thumbnail: 'https://picsum.photos/seed/vid2/80/48', platform: 'YouTube', quality: '720p', date: 'Yesterday', savedTo: 'cloud' },
    { title: 'Street Photography Tokyo', thumbnail: 'https://picsum.photos/seed/vid3/80/48', platform: 'Instagram', quality: '1440p', date: 'Mar 1', savedTo: 'drive' },
    { title: 'Next.js 15 Full Course', thumbnail: 'https://picsum.photos/seed/vid4/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 28', savedTo: 'drive' },
    { title: 'Morning Routine Vlog', thumbnail: 'https://picsum.photos/seed/vid5/80/48', platform: 'TikTok', quality: '720p', date: 'Feb 27', savedTo: 'cloud' },
    { title: 'Deep Focus Study Music', thumbnail: 'https://picsum.photos/seed/vid6/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 26', savedTo: 'cloud' },
    { title: 'City Timelapse 4K', thumbnail: 'https://picsum.photos/seed/vid7/80/48', platform: 'Vimeo', quality: '4K', date: 'Feb 25', savedTo: 'cloud' },
    { title: 'React State Management Guide', thumbnail: 'https://picsum.photos/seed/vid8/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 24', savedTo: 'drive' },
    { title: 'Minimal Desk Setup Tour', thumbnail: 'https://picsum.photos/seed/vid9/80/48', platform: 'Instagram', quality: '720p', date: 'Feb 23', savedTo: 'drive' },
    { title: 'AI Tools You Should Know', thumbnail: 'https://picsum.photos/seed/vid10/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 22', savedTo: 'cloud' },
    { title: 'Barcelona Street Food Tour', thumbnail: 'https://picsum.photos/seed/vid11/80/48', platform: 'YouTube', quality: '1440p', date: 'Feb 21', savedTo: 'drive' },
    { title: 'Figma to Code Workflow', thumbnail: 'https://picsum.photos/seed/vid12/80/48', platform: 'YouTube', quality: '1080p', date: 'Feb 20', savedTo: 'cloud' },
  ];

  ngOnInit(): void {
    this.buildAlerts();
  }

  private buildAlerts(): void {
    this.alerts = [];

    // Drive warnings only — no upsell boxes
    if (this.storagePercent >= 95) {
      this.alerts.push({
        type: 'danger',
        icon: 'warning',
        message: 'Your Google Drive is almost full. Videos will fail to upload until you free up some space.',
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    } else if (this.storagePercent >= 80) {
      this.alerts.push({
        type: 'warn',
        icon: 'cloud_off',
        message: `Your Google Drive is ${this.storagePercent}% full. Clean it up before uploads start failing.`,
        action: 'Open Drive',
        onAction: () => window.open('https://drive.google.com', '_blank'),
      });
    }

    if (this.userPlan === 'Pro') {
      if (this.cloudPercent >= 95) {
        this.alerts.push({
          type: 'danger',
          icon: 'storage',
          message: 'Your personal cloud storage is almost full. New uploads will be blocked.',
        });
      } else if (this.cloudPercent >= 80) {
        this.alerts.push({
          type: 'warn',
          icon: 'storage',
          message: `Your personal storage is ${this.cloudPercent}% full. Consider clearing old downloads.`,
        });
      }
    }
  }
}