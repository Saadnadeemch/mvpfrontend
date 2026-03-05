import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  standalone: true,
  selector: 'app-callback',
  template: `
    <div style="
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    ">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        style="animation: spin 0.9s linear infinite"
        xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="#d9d9d9" stroke-width="3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#3c6e71" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <p style="color: #999; font-size: 14px; margin: 0;">Signing you in…</p>
      <style>
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      </style>
    </div>
  `,
})
export class AuthCallback implements OnInit {
  private router = inject(Router);
  private auth   = inject(AuthService);

  async ngOnInit(): Promise<void> {
    // waitForSessionReady() always returns the real promise.
    // It never short-circuits using isLoading() — that was the SSR bug.
    // On the server this promise stays pending; in the browser it resolves
    // only after Supabase fires SIGNED_IN (post OAuth code exchange).
    const hasSession = await this.auth.waitForSessionReady();

    console.log('[Callback] hasSession:', hasSession);

    if (!hasSession) {
      console.warn('[Callback] No session — redirecting to /login');
      this.router.navigateByUrl('/login');
      return;
    }

    const alreadyChosePlan = await this.auth.hasSelectedPlan();
    console.log('[Callback] hasSelectedPlan:', alreadyChosePlan);

    this.router.navigateByUrl(alreadyChosePlan ? '/bdashboard' : '/pricing');
  }
}