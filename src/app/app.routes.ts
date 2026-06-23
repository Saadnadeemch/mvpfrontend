import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'youtube-downloader',
    title: 'Buckty - Free YouTube Downloader Online 2026',
    loadComponent: () => import('./pages/paltform/youtube/youtube').then(m => m.Youtube),
    data: {
      description: 'Download YouTube videos online for free with Buckty. Save videos in HD and 4K quality, convert YouTube videos to MP3, and enjoy fast downloads without complicated steps.',
      keywords: 'youtube downloader, free youtube downloader, youtube video downloader, download youtube videos, youtube to mp3, youtube mp4 downloader, 4k youtube downloader, online video downloader, buckty'
    }
  },
  {
    path: 'download',
    loadComponent: () => import('./pages/download/download').then(m => m.Download),
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'login',
    title: 'Sign in to Buckty',
    loadComponent: () => import('./pages/login/login').then(m => m.Login),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/authcallback/authcallback').then(m => m.AuthCallback),
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'pricing',
    title: 'Pricing — Buckty',
    loadComponent: () => import('./pages/pricing/pricing').then(m => m.Pricing),
  },
  {
    path: 'dashboard',
    title: 'Dashboard — Buckty',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard),
    data: { robots: 'noindex, nofollow' }
  },
  {
    path: 'privacy-and-policy',
    title: 'Privacy Policy — Buckty',
    loadComponent: () => import('./pages/privacy/privacy').then(m => m.Privacy),
  },
  {
    path: 'terms-of-service',
    title: 'Terms of Service — Buckty',
    loadComponent: () => import('./pages/termservice/termservice').then(m => m.Termservice),
  },
  {
    path: 'apk-download',
    title: 'Download the Apk',
    loadComponent: () => import('./pages/apkdownload/apkdownload').then(m => m.Apkdownload),
  },
  {
    path: 'blog',
    loadComponent: () => import('./pages/blog/blog').then(m => m.Blog),
    data: {
      seo: {
        title: 'Buckty Blog – Video Downloading Guides, Comparisons & Tips (2026)',
        description: 'Read the latest Buckty blog articles covering video downloading guides, tool comparisons, security tips, and the best online downloaders for 2026.',
        keywords: 'buckty blog, video downloader blog, online video downloader guides, download videos 2026, buckty articles, video downloading tips'
      }
    }
  },
  {
    path: 'blog/:slug',
    loadComponent: () => import('./components/blogpost/blogpost').then(m => m.Blogpost),
  },
  {
    path: '**',
    title: 'Page Not Found — Buckty',
    loadComponent: () => import('./pages/notfound/notfound').then(m => m.Notfound),
    data: { robots: 'noindex, nofollow' }
  },
];