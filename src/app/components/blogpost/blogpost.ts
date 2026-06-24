import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Title, Meta, DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { getBlogBySlug, BlogPost, BLOG_POSTS, formatDate } from '../../data/blog';
import { NavbarComponent } from "../navbar/navbar";
import { Footer } from "../footer/footer";

@Component({
  selector: 'app-blogpost',
  imports: [RouterModule, CommonModule, NavbarComponent, Footer],
  templateUrl: './blogpost.html',
  styleUrl: './blogpost.css',
})
export class Blogpost implements OnInit, OnDestroy {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private title     = inject(Title);
  private meta      = inject(Meta);
  private sanitizer = inject(DomSanitizer);
  private document  = inject(DOCUMENT);

  private routeSub!: Subscription;

  post        = signal<BlogPost | null>(null);
  safeContent = signal<SafeHtml | null>(null);
  notFound    = signal(false);
  related     = signal<BlogPost[]>([]);
  openFaq     = signal<number | null>(null);

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');

      // Reset state on every navigation — also purge any lingering schema scripts
      this.openFaq.set(null);
      this.post.set(null);
      this.notFound.set(false);
      this.document.getElementById('article-schema')?.remove();
      this.document.getElementById('faq-schema')?.remove();

      if (!slug) { this.notFound.set(true); return; }

      const found = getBlogBySlug(slug);
      if (!found) {
        this.notFound.set(true);
        this.title.setTitle('Article Not Found – Buckty Blog');
        return;
      }

      this.post.set(found);
      this.safeContent.set(this.sanitizer.bypassSecurityTrustHtml(found.content));

      const pageUrl = `https://www.buckty.cloud/blog/${slug}`;

      // ── Core meta ──────────────────────────────────────────────
      this.title.setTitle(found.seo.title);
      this.meta.updateTag({ name: 'description', content: found.seo.description });
      this.meta.updateTag({ name: 'keywords',    content: found.seo.keywords });
      this.meta.updateTag({ name: 'robots',      content: 'index, follow' });

      // ── Open Graph ─────────────────────────────────────────────
      this.meta.updateTag({ property: 'og:type',        content: 'article' });
      this.meta.updateTag({ property: 'og:url',         content: pageUrl });
      this.meta.updateTag({ property: 'og:title',       content: found.seo.title });
      this.meta.updateTag({ property: 'og:description', content: found.seo.description });
      this.meta.updateTag({ property: 'og:site_name',   content: 'Buckty' });
      if (found.seo.ogImage) {
        this.meta.updateTag({ property: 'og:image',        content: found.seo.ogImage });
        this.meta.updateTag({ property: 'og:image:width',  content: '1200' });
        this.meta.updateTag({ property: 'og:image:height', content: '630' });
        // FIX 1: update og:image:alt per post (was never being set — inherited homepage value)
        this.meta.updateTag({ property: 'og:image:alt', content: found.seo.title });
      }

      // ── article:* tags — required when og:type = article ───────
      // FIX 2: these were never injected; crawlers expect them for Article type
      this.meta.updateTag({ property: 'article:published_time', content: found.publishedAt });
      this.meta.updateTag({ property: 'article:modified_time',  content: found.seo.dateModified ?? found.publishedAt });
      this.meta.updateTag({ property: 'article:author',         content: 'Buckty' });

      // ── Twitter Card ───────────────────────────────────────────
      this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
      this.meta.updateTag({ name: 'twitter:title',       content: found.seo.title });
      this.meta.updateTag({ name: 'twitter:description', content: found.seo.description });
      if (found.seo.ogImage) {
        this.meta.updateTag({ name: 'twitter:image',     content: found.seo.ogImage });
        // FIX 3: update twitter:image:alt per post (was never being set — inherited homepage value)
        this.meta.updateTag({ name: 'twitter:image:alt', content: found.seo.title });
      }

      // ── Canonical <link> ───────────────────────────────────────
      let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = this.document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        this.document.head.appendChild(canonical);
      }
      canonical.setAttribute('href', pageUrl);

      // ── Article schema (JSON-LD) ────────────────────────────────
      const articleSchema = {
        '@context':      'https://schema.org',
        '@type':         'Article',
        'headline':      found.seo.title,
        'description':   found.seo.description,
        'url':           pageUrl,
        'datePublished': found.publishedAt,
        'dateModified':  found.seo.dateModified ?? found.publishedAt,
        'image':         found.seo.ogImage ?? '',
        'author': {
          '@type': 'Organization',
          'name':  'Buckty',
          'url':   'https://www.buckty.cloud',
        },
        'publisher': {
          '@type': 'Organization',
          'name':  'Buckty',
          'url':   'https://www.buckty.cloud',
          'logo': {
            '@type': 'ImageObject',
            'url':   'https://www.buckty.cloud/buckty.png',
          },
        },
      };

      const articleScript = this.document.createElement('script');
      articleScript.id   = 'article-schema';
      articleScript.type = 'application/ld+json';
      articleScript.text = JSON.stringify(articleSchema);
      this.document.head.appendChild(articleScript);

      // ── FAQPage schema (JSON-LD) — separate script tag ─────────
      if (found.seo.faq?.length) {
        const faqSchema = {
          '@context':   'https://schema.org',
          '@type':      'FAQPage',
          'mainEntity': found.seo.faq.map(item => ({
            '@type':          'Question',
            'name':           item.q,
            'acceptedAnswer': { '@type': 'Answer', 'text': item.a },
          })),
        };

        const faqScript = this.document.createElement('script');
        faqScript.id   = 'faq-schema';
        faqScript.type = 'application/ld+json';
        faqScript.text = JSON.stringify(faqSchema);
        this.document.head.appendChild(faqScript);
      }

      // ── Related posts ──────────────────────────────────────────
      const rel = BLOG_POSTS
        .filter(p => p.slug !== slug && p.category === found.category)
        .slice(0, 2);

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

  ngOnDestroy() {
    // FIX 4: when navigating away from any blog post, clean up everything this
    // component injected so the next page (e.g. homepage) doesn't inherit article state
    this.routeSub?.unsubscribe();

    this.document.getElementById('article-schema')?.remove();
    this.document.getElementById('faq-schema')?.remove();

    // Restore og:type to website (homepage default)
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // Remove article:* tags — these have no meaning on non-article pages
    this.meta.removeTag("property='article:published_time'");
    this.meta.removeTag("property='article:modified_time'");
    this.meta.removeTag("property='article:author'");

    // Restore canonical to homepage
    const canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://www.buckty.cloud/');
  }

  toggleFaq(index: number) {
    this.openFaq.set(this.openFaq() === index ? null : index);
  }

  formatDate = formatDate;
}