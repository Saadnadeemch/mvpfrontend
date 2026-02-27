import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Router} from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule ],
  templateUrl: './login.html',
})
export class Login {
isLoading = false;
router = inject(Router)
  loginWithGoogle() {
    if (this.isLoading) return;
    this.isLoading = true;

    // Replace this block with your actual OAuth / Firebase call.
    // The button stays in place — only the right-side icon changes to a spinner.
    // Example with Firebase:
    //
    // import { getAuth, signInWithRedirect, GoogleAuthProvider } from 'firebase/auth';
    // const auth = getAuth();
    // signInWithRedirect(auth, new GoogleAuthProvider());
    //
    // Using redirect means zero popup — the page navigates away and comes back.
    // For now we simulate a short delay so you can see the loading state:
    setTimeout(() => {
      this.isLoading = false;
       this.router.navigate(['/dashboard']);
    }, 3000);
  }
}
