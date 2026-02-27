import {Routes} from '@angular/router';
import { Home } from './pages/home/home';
import { Download } from './pages/download/download';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'download', component: Download },
  { path: 'login', component: Login },
  { path: 'dashboard' , component:Dashboard},
  { path: '**', redirectTo: '' }
];
