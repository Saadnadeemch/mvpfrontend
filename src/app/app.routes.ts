import {Routes} from '@angular/router';
import { Home } from './pages/home/home';
import { Download } from './pages/download/download';
import { Login } from './pages/login/login';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'download', component: Download },
  { path: 'login', component: Login },
  { path: '**', redirectTo: '' }
];
