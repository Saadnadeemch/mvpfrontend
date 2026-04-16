import {Routes} from '@angular/router';
import { Home } from './pages/home/home';
import { Download } from './pages/download/download';
import { Login } from './pages/login/login';
import { AuthCallback } from './pages/authcallback/authcallback';
import { Pricing } from './pages/pricing/pricing';
import { Privacy } from './pages/privacy/privacy';
import { Termservice } from './pages/termservice/termservice';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'download', component: Download },
  { path: 'login', component: Login },
  { path: 'auth/callback', component: AuthCallback },
  { path: 'pricing' , component:Pricing },
  { path: 'dashboard' , component:Dashboard},
  { path: 'privacy-and-policy' , component:Privacy},
  { path: 'terms-of-service' , component:Termservice},
  { path: '**', redirectTo: '' }
];
