import { RenderMode, ServerRoute } from '@angular/ssr';
import { BLOG_POSTS } from './data/blog';

export const serverRoutes: ServerRoute[] = [
  { path: 'dashboard',     renderMode: RenderMode.Server },
  { path: 'auth/callback', renderMode: RenderMode.Server },
  { path: 'download',      renderMode: RenderMode.Server },
  {
    path: 'blog/:slug',
    renderMode: RenderMode.Prerender,
    getPrerenderParams: async () => BLOG_POSTS.map(post => ({ slug: post.slug })),
  },
  { path: '**',            renderMode: RenderMode.Prerender },
];