import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  standalone: true,
  selector: 'app-callback',
  template: `<p>Signing you in...</p>`,
})
export class AuthCallback implements OnInit {
  private router = inject(Router);
  private auth   = inject(AuthService);

  async ngOnInit(): Promise<void> {
    // Wait until Supabase finishes restoring session
    await this.auth.waitForSessionReady();

    // Now signals are updated safely
    if (this.auth.isLoggedIn()) {
      this.router.navigateByUrl('/bdashboard');
    } else {
      this.router.navigateByUrl('/bdashboard');
    }
  }
}