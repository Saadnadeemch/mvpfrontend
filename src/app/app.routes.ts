// app.routes.ts
import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Download } from './pages/download/download';
import { Login } from './pages/login/login';
import { AuthCallback } from './pages/authcallback/authcallback';
import { Pricing } from './pages/pricing/pricing';
import { Privacy } from './pages/privacy/privacy';
import { Termservice } from './pages/termservice/termservice';
import { Dashboard } from './pages/dashboard/dashboard';
import { Notfound } from './pages/notfound/notfound';
import { Youtube } from './pages/paltform/youtube/youtube';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'youtube-downloader',
    title: 'Buckty - Free YouTube Downloader Online 2026',
    component: Youtube,
    data: {
      description:
        'Download YouTube videos online for free with Buckty. Save videos in HD and 4K quality, convert YouTube videos to MP3, and enjoy fast downloads without complicated steps.',
      keywords:
        'youtube downloader, free youtube downloader, youtube video downloader, download youtube videos, youtube to mp3, youtube mp4 downloader, 4k youtube downloader, online video downloader, buckty'
    }
  },
  {
    path: 'download',
    component: Download,
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'login',
    title: 'Sign in to Buckty',
    component: Login,
  },
  {
    path: 'auth/callback',
    component: AuthCallback,
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'pricing',
    title: 'Pricing — Buckty',
    component: Pricing,
  },
  {
    path: 'dashboard',
    title: 'Dashboard — Buckty',
    component: Dashboard,
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'privacy-and-policy',
    title: 'Privacy Policy — Buckty',
    component: Privacy,
  },
  {
    path: 'terms-of-service',
    title: 'Terms of Service — Buckty',
    component: Termservice,
  },
  {
    path: '**',
    title: 'Page Not Found — Buckty',
    component: Notfound,
    data: { robots: 'noindex, nofollow' }
  }
];