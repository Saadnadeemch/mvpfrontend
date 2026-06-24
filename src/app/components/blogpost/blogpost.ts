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

  post             = signal<BlogPost | null>(null);
  safeContent      = signal<SafeHtml | null>(null);
  notFound         = signal(false);
  related          = signal<BlogPost[]>([]);
  openFaq          = signal<number | null>(null);

  // Signals for JSON-LD schemas — rendered via [innerHTML] in the template so
  // Angular SSR serialises them into the prerendered HTML for crawlers.
  articleSchemaJson = signal<SafeHtml | null>(null);
  faqSchemaJson     = signal<SafeHtml | null>(null);

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');

      // Reset all state on every navigation
      this.openFaq.set(null);
      this.post.set(null);
      this.notFound.set(false);
      this.articleSchemaJson.set(null);
      this.faqSchemaJson.set(null);

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
        this.meta.updateTag({ property: 'og:image:alt',    content: found.seo.title });
      }

      // ── article:* tags (placeholders exist in index.html so updateTag works) ─
      this.meta.updateTag({ property: 'article:published_time', content: found.publishedAt });
      this.meta.updateTag({ property: 'article:modified_time',  content: found.seo.dateModified ?? found.publishedAt });
      this.meta.updateTag({ property: 'article:author',         content: 'Buckty' });

      // ── Twitter Card ───────────────────────────────────────────
      this.meta.updateTag({ name: 'twitter:card',        content: 'summary_large_image' });
      this.meta.updateTag({ name: 'twitter:title',       content: found.seo.title });
      this.meta.updateTag({ name: 'twitter:description', content: found.seo.description });
      if (found.seo.ogImage) {
        this.meta.updateTag({ name: 'twitter:image',     content: found.seo.ogImage });
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
      // Rendered via [innerHTML] signal in the template — this is the only approach
      // that survives Angular SSR serialisation. document.createElement + appendChild
      // gets stripped by Angular's SSR security serialiser before the HTML is written.
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

      this.articleSchemaJson.set(
        this.sanitizer.bypassSecurityTrustHtml(
          `<script type="application/ld+json">${JSON.stringify(articleSchema)}<\/script>`
        )
      );

      // ── FAQPage schema (JSON-LD) ────────────────────────────────
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

        this.faqSchemaJson.set(
          this.sanitizer.bypassSecurityTrustHtml(
            `<script type="application/ld+json">${JSON.stringify(faqSchema)}<\/script>`
          )
        );
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
    // Unsubscribe to prevent memory leaks
    this.routeSub?.unsubscribe();

    // Clear schema signals so they don't leak into other routes
    this.articleSchemaJson.set(null);
    this.faqSchemaJson.set(null);

    // Restore og:type to website (homepage default)
    this.meta.updateTag({ property: 'og:type', content: 'website' });

    // Clear article:* tags — meaningless on non-article pages
    this.meta.updateTag({ property: 'article:published_time', content: '' });
    this.meta.updateTag({ property: 'article:modified_time',  content: '' });
    this.meta.updateTag({ property: 'article:author',         content: '' });

    // Restore canonical to homepage
    const canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://www.buckty.cloud/');
  }

  toggleFaq(index: number) {
    this.openFaq.set(this.openFaq() === index ? null : index);
  }

  formatDate = formatDate;
}