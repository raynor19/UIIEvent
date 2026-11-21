import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { BottomNavComponent } from './shared/components/bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, BottomNavComponent],
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private router = inject(Router);
  isStandaloneLayout = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.updateStandaloneLayout(window.location.pathname);
    }
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.updateStandaloneLayout(event.urlAfterRedirects || event.url || '');
      });
  }

  private updateStandaloneLayout(url: string) {
    const lower = (url || '').toLowerCase();
    this.isStandaloneLayout = 
      lower.includes('/login') || 
      lower.includes('/dashboard/panitia') || 
      lower.includes('/organizer') ||
      lower.includes('/scanner') ||
      lower.includes('/dashboard/admin') ||
      lower.includes('/admin');
  }
}
