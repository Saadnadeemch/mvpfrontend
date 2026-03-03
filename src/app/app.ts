import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('Buckty');
  isDark = true;
  isProfileOpen = false;
  isCancelModalOpen = false;
  isCancelling = false;

  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private router = inject(Router);

  // ── Computed from auth service ──
  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn();
  }

  get currentUser() {
    const user = this.auth.currentUser();
    return {
      name: user?.user_metadata?.['full_name'] ?? 'User',
      firstName: (user?.user_metadata?.['full_name'] as string)?.split(' ')[0] ?? 'User',
      email: user?.email ?? '',
      avatar: user?.user_metadata?.['avatar_url'] ?? `https://api.dicebear.com/9.x/notionists/svg?seed=${user?.email}`,
      // Read plan from JWT custom claim — set via Supabase hook
      plan: this.auth.isPaid() ? 'Pro' : 'Basic' as 'Free' | 'Basic' | 'Pro',
    };
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
  }

  toggleProfile(): void {
    this.isProfileOpen = !this.isProfileOpen;
  }

  openCancelModal(): void {
    this.isCancelModalOpen = true;
  }

  closeCancelModal(): void {
    if (this.isCancelling) return;
    this.isCancelModalOpen = false;
  }

  confirmCancel(): void {
    this.isCancelling = true;

    // Hook to your Stripe cancellation endpoint here
    // this.subscriptionService.cancel().subscribe(() => { ... })

    setTimeout(() => {
      this.isCancelling = false;
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