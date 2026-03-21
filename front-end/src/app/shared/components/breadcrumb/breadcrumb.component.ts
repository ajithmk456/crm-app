import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../../features/auth/auth.service';

interface BreadcrumbItem {
  label: string;
  url: string;
  clickable: boolean;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss'
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  items: BreadcrumbItem[] = [];
  private routerSubscription?: Subscription;

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.updateBreadcrumbs();
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.updateBreadcrumbs());
  }

  ngOnDestroy(): void {
    this.routerSubscription?.unsubscribe();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateBreadcrumbs();
  }

  get renderedItems(): BreadcrumbItem[] {
    if (window.innerWidth > 768 || this.items.length <= 2) {
      return this.items;
    }

    const first = this.items[0];
    const last = this.items[this.items.length - 1];

    return [
      first,
      { label: '...', url: '', clickable: false },
      { ...last, clickable: false }
    ];
  }

  navigate(item: BreadcrumbItem): void {
    if (!item.clickable || !item.url) {
      return;
    }

    this.router.navigateByUrl(item.url);
  }

  private updateBreadcrumbs(): void {
    const routeItems = this.collectRouteItems(this.activatedRoute.root);
    const currentUrl = this.router.url.split('?')[0];
    const home = this.getHomeCrumb();

    let items = routeItems;

    if (routeItems.length > 0 && routeItems[0].url !== home.url) {
      items = [home, ...routeItems];
    }

    if (routeItems.length === 0) {
      items = [home];
    }

    this.items = items.map((item, index) => ({
      ...item,
      clickable: index < items.length - 1 && item.url !== currentUrl
    }));
  }

  private collectRouteItems(route: ActivatedRoute, url = '', breadcrumbs: BreadcrumbItem[] = []): BreadcrumbItem[] {
    for (const child of route.children) {
      const routeUrl = child.snapshot.url.map((segment) => segment.path).join('/');
      const nextUrl = routeUrl ? `${url}/${routeUrl}` : url;
      const breadcrumbLabel = child.snapshot.data['breadcrumb'];

      if (breadcrumbLabel) {
        breadcrumbs.push({
          label: breadcrumbLabel,
          url: nextUrl || '/',
          clickable: true,
        });
      }

      return this.collectRouteItems(child, nextUrl, breadcrumbs);
    }

    return breadcrumbs;
  }

  private getHomeCrumb(): BreadcrumbItem {
    const isAdmin = this.authService.isAdmin();

    if (isAdmin) {
      return { label: 'Dashboard', url: '/dashboard', clickable: true };
    }

    return { label: 'Employee Dashboard', url: '/employee-dashboard', clickable: true };
  }
}