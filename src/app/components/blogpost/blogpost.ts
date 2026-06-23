import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title, Meta, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getBlogBySlug, BlogPost, BLOG_POSTS, formatDate } from '../../data/blog';
import { NavbarComponent } from "../navbar/navbar";
import { Footer } from "../footer/footer";

@Component({
  selector: 'app-blogpost',
  imports: [RouterModule, CommonModule, NavbarComponent, Footer],
  templateUrl: './blogpost.html',
  styleUrl: './blogpost.css',
})
export class Blogpost implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);
  private sanitizer = inject(DomSanitizer);

  post = signal<BlogPost | null>(null);
  safeContent = signal<SafeHtml | null>(null);
  notFound = signal(false);
  related = signal<BlogPost[]>([]);

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (!slug) { this.notFound.set(true); return; }

      const found = getBlogBySlug(slug);
      if (!found) {
        this.notFound.set(true);
        this.title.setTitle('Article Not Found – Buckty Blog');
        return;
      }

      this.post.set(found);
      this.safeContent.set(this.sanitizer.bypassSecurityTrustHtml(found.content));
      this.notFound.set(false);

      // SEO
      this.title.setTitle(found.seo.title);
      this.meta.updateTag({ name: 'description', content: found.seo.description });
      this.meta.updateTag({ name: 'keywords', content: found.seo.keywords });
      this.meta.updateTag({ property: 'og:title', content: found.seo.title });
      this.meta.updateTag({ property: 'og:description', content: found.seo.description });
      if (found.seo.ogImage) {
        this.meta.updateTag({ property: 'og:image', content: found.seo.ogImage });
      }

      // Related: same category, exclude current, max 2
      const rel = BLOG_POSTS
        .filter(p => p.slug !== slug && p.category === found.category)
        .slice(0, 2);

      // Fill with recent posts if not enough same-category
      if (rel.length < 2) {
        const extra = BLOG_POSTS
          .filter(p => p.slug !== slug && !rel.find(r => r.slug === p.slug))
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          .slice(0, 2 - rel.length);
        rel.push(...extra);
      }
      this.related.set(rel);
    });
  }

  formatDate = formatDate;
}