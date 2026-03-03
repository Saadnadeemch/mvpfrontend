import {Routes} from '@angular/router';
import { Home } from './pages/home/home';
import { Download } from './pages/download/download';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { AuthCallback } from './pages/authcallback/authcallback';
import { Pricing } from './pages/pricing/pricing';
import { BasicDashboard } from './pages/basic-dashboard/basic-dashboard';
import { Privacy } from './pages/privacy/privacy';
import { Termservice } from './pages/termservice/termservice';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'download', component: Download },
  { path: 'login', component: Login },
  { path: 'auth/callback', component: AuthCallback },
  { path: 'dashboard' , component:Dashboard},
  { path: 'pricing' , component:Pricing },
  { path: 'bdashboard' , component:BasicDashboard},
  { path: 'privacy-and-policy' , component:Privacy},
  { path: 'terms-of-service' , component:Termservice},
  { path: '**', redirectTo: '' }
];
