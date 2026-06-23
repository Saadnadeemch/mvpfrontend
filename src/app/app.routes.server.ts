import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'dashboard',     renderMode: RenderMode.Server },
  { path: 'auth/callback', renderMode: RenderMode.Server },
  { path: 'download',      renderMode: RenderMode.Server },
  { path: 'blog/:slug',    renderMode: RenderMode.Server },
  { path: '**',            renderMode: RenderMode.Prerender },
];