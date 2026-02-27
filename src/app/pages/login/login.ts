import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
})
export class Login {
  private router = inject(Router);

  loginWithGoogle() {
    setTimeout(() => {
      this.router.navigate(['/']);
    }, 2000);
  }
}
