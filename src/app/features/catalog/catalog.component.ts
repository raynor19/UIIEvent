import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { EventItem, EventCategory } from '../../core/models/event.model';

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './catalog.component.html'
})
export class CatalogComponent implements OnInit {
  eventService = inject(EventService);
  authService = inject(AuthService);
  router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.eventService.syncWithBackend();
  }

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');
  activeDetailEvent = signal<EventItem | null>(null);

  // Featured event carousel index
  featuredIndex = signal<number>(0);

  categories = [
    { label: 'Semua', value: 'ALL' },
    { label: 'Seminar', value: 'SEMINAR' },
    { label: 'Workshop', value: 'WORKSHOP' },
    { label: 'Lomba', value: 'LOMBA' },
    { label: 'Konser', value: 'KONSER' },
    { label: 'Open Recruitment', value: 'COMMITTEE_RECRUITMENT' },
  ];

  allPublishedEvents = computed(() => {
    return this.eventService.events().filter(e => e.status === 'PUBLISHED');
  });

  featuredEvents = computed(() => {
    return this.allPublishedEvents().slice(0, 4);
  });

  currentFeatured = computed(() => {
    const list = this.featuredEvents();
    if (list.length === 0) return null;
    const idx = this.featuredIndex() % list.length;
    return list[idx];
  });

  filteredEvents = computed(() => {
    let list = this.allPublishedEvents();
    const cat = this.selectedCategory();
    const q = this.searchQuery().trim().toLowerCase();

    if (cat !== 'ALL') {
      list = list.filter(e => e.category === cat);
    }

    if (q) {
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.organizer.toLowerCase().includes(q) ||
        e.room.toLowerCase().includes(q) ||
        (e.speaker && e.speaker.name.toLowerCase().includes(q))
      );
    }

    return list;
  });

  nextFeatured(): void {
    const len = this.featuredEvents().length;
    if (len > 0) {
      this.featuredIndex.update(i => (i + 1) % len);
    }
  }

  prevFeatured(): void {
    const len = this.featuredEvents().length;
    if (len > 0) {
      this.featuredIndex.update(i => (i - 1 + len) % len);
    }
  }

  selectFeatured(idx: number): void {
    this.featuredIndex.set(idx);
  }

  isUserRegistered(eventId: string): boolean {
    const user = this.authService.currentUser();
    return this.eventService.isUserRegistered(user.id, eventId);
  }

  getCategoryBadgeClass(category: EventCategory): string {
    switch (category) {
      case 'SEMINAR':
        return 'bg-blue-600 text-white';
      case 'WORKSHOP':
        return 'bg-purple-600 text-white';
      case 'LOMBA':
        return 'bg-amber-500 text-slate-950 font-bold';
      case 'COMMITTEE_RECRUITMENT':
        return 'bg-emerald-600 text-white';
      case 'KONSER':
        return 'bg-pink-600 text-white';
      default:
        return 'bg-slate-700 text-white';
    }
  }

  openDetail(event: EventItem): void {
    this.activeDetailEvent.set(event);
  }

  closeDetail(): void {
    this.activeDetailEvent.set(null);
  }

  goToRegister(event: EventItem): void {
    this.closeDetail();
    this.router.navigate(['/register', event.id]);
  }
}
