import { CommonModule } from '@angular/common';
import { Component, signal, computed, effect, inject, OnInit, ElementRef, HostListener } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { ThemeService } from '../../services/themeService';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  // NO OnPush — default CD works correctly with signals
})
export class NavbarComponent implements OnInit {

  // ── UI state signals ─────────────────────────────────────────
  isProfileOpen = signal(false);

  // ── User / plan state signals ─────────────────────────────────
  private _planLabel = signal<string>('Free');
  private _isTrial   = signal<boolean>(false);

  // ── Injected services ─────────────────────────────────────────
  private theme   = inject(ThemeService);
  private router  = inject(Router);
  private elRef   = inject(ElementRef);
  auth            = inject(AuthService);

  // ── Computed values used directly in template ─────────────────
  isDark     = computed(() => this.theme.isDark());
  isLoggedIn = computed(() => !!this.auth.currentUser());

  currentUser = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return null;

    const fullName = (u.user_metadata?.['full_name'] as string) ?? 'User';
    return {
      name:      fullName,
      firstName: fullName.split(' ')[0],
      email:     u.email ?? '',
      avatar:
        (u.user_metadata?.['avatar_url'] as string) ??
        `https://api.dicebear.com/9.x/notionists/svg?seed=${u.email}`,
      plan:    this._planLabel(),   // reactive — updates after DB fetch
      isTrial: this._isTrial(),
    };
  });

  constructor() {
    // Watch for user changes → reload plan from DB each time user changes
    effect(() => {
      const u = this.auth.currentUser();
      if (u) {
        // Reset to Free while we fetch
        this._planLabel.set('Free');
        this._isTrial.set(false);
        this.loadPlanFromProfile();
      } else {
        // User signed out — reset plan state immediately
        this._planLabel.set('Free');
        this._isTrial.set(false);
      }
    });
  }

  ngOnInit(): void {}

  // ── Close dropdown on outside click ──────────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isProfileOpen()) return;
    const clickedInside = this.elRef.nativeElement.contains(event.target as Node);
    if (!clickedInside) {
      this.isProfileOpen.set(false);
    }
  }

  // ── Load real plan from DB ────────────────────────────────────
  private async loadPlanFromProfile(): Promise<void> {
    const profile = await this.auth.getProfile();
    if (!profile) return;

    const tier     = profile.payment_price_id ?? 'free';
    const isActive = profile.membership_type === 'monthly' || profile.membership_type === 'yearly';

    // Update signals — template re-renders automatically
    this._planLabel.set(isActive ? (tier === 'pro' ? 'Pro' : 'Basic') : 'Free');
    this._isTrial.set(profile.is_trial ?? false);
  }

  // ── Actions ───────────────────────────────────────────────────
  toggleTheme(): void {
    this.theme.toggle();
  }

  toggleProfile(): void {
    this.isProfileOpen.update(v => !v);
  }

  closeProfile(): void {
    this.isProfileOpen.set(false);
  }

  goToDashboard(): void {
    this.isProfileOpen.set(false);
    this.router.navigate(['/bdashboard']);
  }

  logout(): void {
    this.isProfileOpen.set(false);
    this.auth.logout();
  }
}