import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BLOG_POSTS, BlogPost, getPaginatedBlogs, formatDate } from '../../data/blog'
import { NavbarComponent } from "../../components/navbar/navbar";
import { Footer } from "../../components/footer/footer";
 
@Component({
  selector: 'app-blog',
  imports: [CommonModule, RouterModule, NavbarComponent, Footer],
  templateUrl: './blog.html',
  styleUrl: './blog.css',
})
export class Blog implements OnInit {
  private readonly PER_PAGE = 10;
  private page = signal(1);
 
  allFiltered = signal<BlogPost[]>([]);
  visiblePosts = signal<BlogPost[]>([]);
  hasMore = signal(false);
  loading = signal(false);
  activeCategory = signal('All');
  prevCount = signal(0);
 
  categories = computed(() => {
    const cats = ['All', ...new Set(BLOG_POSTS.map(p => p.category))];
    return cats;
  });
 
  ngOnInit() {
    this.applyFilter();
  }
 
  setCategory(cat: string) {
    this.activeCategory.set(cat);
    this.page.set(1);
    this.prevCount.set(0);
    this.applyFilter();
  }
 
  applyFilter() {
    const sorted = [...BLOG_POSTS].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    const filtered = this.activeCategory() === 'All'
      ? sorted
      : sorted.filter(p => p.category === this.activeCategory());
 
    this.allFiltered.set(filtered);
    const slice = filtered.slice(0, this.PER_PAGE);
    this.visiblePosts.set(slice);
    this.hasMore.set(filtered.length > this.PER_PAGE);
  }
 
  loadMore() {
    this.loading.set(true);
    this.prevCount.set(this.visiblePosts().length);
 
    setTimeout(() => {
      this.page.update(p => p + 1);
      const start = 0;
      const end = this.page() * this.PER_PAGE;
      const next = this.allFiltered().slice(start, end);
      this.visiblePosts.set(next);
      this.hasMore.set(end < this.allFiltered().length);
      this.loading.set(false);
    }, 400);
  }
 
  formatDate = formatDate;
}
