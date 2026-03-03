import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  protected readonly title = signal('Buckty');

  isDark = true;
  isProfileOpen = false;
  isCancelModalOpen = false;
  isCancelling = false;

  isLoggedIn = false;
  currentUser: {
    name: string;
    firstName: string;
    email: string;
    avatar: string;
    plan: 'Free' | 'Basic' | 'Pro';
  } | null = null;

  private platformId = inject(PLATFORM_ID);
  private router     = inject(Router);
  cdr        = inject(ChangeDetectorRef);
  auth       = inject(AuthService);

  constructor() {
    effect(() => {
      const u = this.auth.currentUser();

      this.isLoggedIn = !!u;

      if (u) {
        const fullName = (u.user_metadata?.['full_name'] as string) ?? 'User';

        this.currentUser = {
          name: fullName,
          firstName: fullName.split(' ')[0],
          email: u.email ?? '',
          avatar:
            (u.user_metadata?.['avatar_url'] as string) ??
            `https://api.dicebear.com/9.x/notionists/svg?seed=${u.email}`,
          plan: this.auth.isPaid() ? 'Pro' : 'Basic',
        };
      } else {
        this.currentUser = null;
      }

      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', this.isDark);
    }
  }

  toggleTheme(): void {
    this.isDark = !this.isDark;
    if (isPlatformBrowser(this.platformId)) {
      document.documentElement.classList.toggle('dark', this.isDark);
    }
    this.cdr.markForCheck();
  }

  toggleProfile(): void {
    this.isProfileOpen = !this.isProfileOpen;
    this.cdr.markForCheck();
  }

  openCancelModal(): void {
    this.isCancelModalOpen = true;
    this.isProfileOpen     = false;
    this.cdr.markForCheck();
  }

  closeCancelModal(): void {
    if (this.isCancelling) return;
    this.isCancelModalOpen = false;
    this.cdr.markForCheck();
  }

  confirmCancel(): void {
    this.isCancelling = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.isCancelling      = false;
      this.isCancelModalOpen = false;
      this.logout();
    }, 1500);
  }

  logout(): void {
    this.isProfileOpen = false;
    this.auth.logout().then(() => {
      this.router.navigate(['/']);
    });
  }
}