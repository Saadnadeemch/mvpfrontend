import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../../components/navbar/navbar';
import { Footer } from '../../components/footer/footer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, NavbarComponent, Footer],
  templateUrl: './login.html',
})
export class Login {
  auth = inject(AuthService);

  async loginWithGoogle() {
    if (this.auth.isLoading()) return;

    try {
      await this.auth.loginWithGoogle();
    } catch (err) {
      console.error(err);
    }
  }
}