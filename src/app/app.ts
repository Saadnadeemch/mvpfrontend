import { Component, inject } from '@angular/core';
import {
  Router,
  NavigationEnd,
  ActivatedRoute,
  RouterOutlet
} from '@angular/router';

import { Meta, Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private meta = inject(Meta);
  private title = inject(Title);

  ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {

        let route = this.activatedRoute;

        while (route.firstChild) {
          route = route.firstChild;
        }

        const data = route.snapshot.data;
        const pageTitle = route.snapshot.title;

        // Title
        if (pageTitle) {
          this.title.setTitle(pageTitle);
        }

        // Description
        if (data?.['description']) {
          this.meta.updateTag({
            name: 'description',
            content: data['description']
          });
        }

        // Keywords
        if (data?.['keywords']) {
          this.meta.updateTag({
            name: 'keywords',
            content: data['keywords']
          });
        }

        // Robots
        this.meta.updateTag({
          name: 'robots',
          content: data?.['robots'] ?? 'index, follow'
        });

      });
  }
}