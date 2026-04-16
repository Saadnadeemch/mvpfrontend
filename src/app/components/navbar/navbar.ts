import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  signal,
  computed,
  effect,
  inject,
  OnInit,
  ElementRef,
  HostListener
} from '@angular/core';

import { RouterModule, Router } from '@angular/router';
import { ThemeService } from '../../services/themeService';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
})
export class NavbarComponent implements OnInit {

  // ── UI STATE ───────────────────────────────────────────────
  isProfileOpen = signal(false);

  // ── USER STATE ──────────────────────────────────────────────
  private _planLabel = signal<string>('Free');
  private _isTrial   = signal<boolean>(false);

  // ── INJECTED ────────────────────────────────────────────────
  private theme  = inject(ThemeService);
  private router = inject(Router);
  private elRef  = inject(ElementRef);
  auth           = inject(AuthService);

  // ── COMPUTED USER ───────────────────────────────────────────
  currentUser = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return null;

    const fullName =
      (u.user_metadata?.['full_name'] as string) ?? 'User';

    return {
      name: fullName,
      firstName: fullName.split(' ')[0],
      email: u.email ?? '',

      avatar:
        (u.user_metadata?.['avatar_url'] as string) ??
        `https://api.dicebear.com/9.x/notionists/svg?seed=${u.email}`,

      plan: this._planLabel(),
      isTrial: this._isTrial(),
    };
  });

  isDark = computed(() => this.theme.isDark());
  isLoggedIn = computed(() => !!this.auth.currentUser());

  constructor() {
    effect(() => {
      const user = this.auth.currentUser();

      if (user) {
        this._planLabel.set('Loading...');
        this._isTrial.set(false);
        this.loadPlanFromProfile();
      } else {
        this._planLabel.set('Free');
        this._isTrial.set(false);
      }
    });
  }

  ngOnInit(): void {}

  // ── OUTSIDE CLICK ───────────────────────────────────────────
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isProfileOpen()) return;

    const clickedInside =
      this.elRef.nativeElement.contains(event.target as Node);

    if (!clickedInside) {
      this.isProfileOpen.set(false);
    }
  }

  // ── LOAD PROFILE (FIXED LOGIC) ──────────────────────────────
  private async loadPlanFromProfile(): Promise<void> {
    const profile = await this.auth.getProfile();
    if (!profile) return;

    const planType = profile.plan_type ?? 'basic';
    const membership = profile.membership_type;

    const isActive =
      membership === 'monthly' || membership === 'yearly';

    // Map plan_type → UI label
    let label = 'Free';

    if (isActive) {
      if (planType === 'advanced') {
        label = 'Advanced';
      } else {
        label = 'Basic';
      }
    }

    this._planLabel.set(label);
    this._isTrial.set(profile.is_trial ?? false);
  }

  // ── ACTIONS ────────────────────────────────────────────────
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