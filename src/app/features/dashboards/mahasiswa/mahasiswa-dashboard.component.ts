import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { EventService } from '../../../core/services/event.service';
import { TicketItem, CertificateItem } from '../../../core/models/ticket.model';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-mahasiswa-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './mahasiswa-dashboard.component.html'
})
export class MahasiswaDashboardComponent {
  authService = inject(AuthService);
  eventService = inject(EventService);

  currentUser = this.authService.currentUser;

  // Active Tab: Terdaftar, Riwayat Selesai, Oprec & Lainnya
  activeTab = signal<'TERDAFTAR' | 'RIWAYAT' | 'OPREC'>('TERDAFTAR');
  searchQuery = signal<string>('');

  // Filtered student registrations, tickets & certs
  myRegistrations = computed(() => {
    const user = this.currentUser();
    return this.eventService.registrations().filter(r => 
      (r.userId === user.id || r.userNim === user.nim) && 
      r.status !== 'CANCELLED'
    );
  });

  myTickets = computed(() => {
    const user = this.currentUser();
    return this.eventService.tickets().filter(t => 
      t.userId === user.id || 
      t.userNim === user.nim
    );
  });

  myCertificates = computed(() => {
    const user = this.currentUser();
    return this.eventService.certificates().filter(c => 
      c.userId === user.id || c.userNim === user.nim
    );
  });

  totalSkpiPoints = computed(() =>
    this.myCertificates().reduce((sum, cert) => sum + cert.skpiPoints, 0)
  );

  attendedCount = computed(() =>
    this.myRegistrations().filter(r => r.status === 'ATTENDED').length
  );

  // Filtered by Search & Tab
  terdaftarTickets = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.myTickets().filter(t => {
      const matchSearch = !q || t.eventTitle.toLowerCase().includes(q) || t.eventCategory.toLowerCase().includes(q) || t.ticketCode.toLowerCase().includes(q);
      return matchSearch;
    });
  });

  riwayatCertificates = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.myCertificates().filter(c => {
      return !q || c.eventTitle.toLowerCase().includes(q) || c.certificateNumber.toLowerCase().includes(q);
    });
  });

  oprecRegistrations = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.myRegistrations().filter(r => {
      const isOprec = r.eventId.includes('oprec') || r.category?.toUpperCase() === 'OPREC' || r.selectionStatus !== undefined;
      const matchSearch = !q || r.eventTitle.toLowerCase().includes(q);
      return isOprec && matchSearch;
    });
  });

  // Catalog events list synchronized with main catalog
  allCatalogEvents = computed(() => {
    return this.eventService.events().filter(e => e.status === 'PUBLISHED');
  });

  isUserRegisteredForEvent(eventId: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    return this.eventService.isUserRegistered(user.id, eventId);
  }

  // Active Ticket QR Modal
  selectedTicketForQr = signal<TicketItem | null>(null);
  ticketQrDataUrl = signal<string>('');

  async openTicketQrModal(ticket: TicketItem): Promise<void> {
    this.selectedTicketForQr.set(ticket);
    try {
      const dataUrl = await QRCode.toDataURL(ticket.qrPayload, {
        width: 320,
        margin: 2,
        color: {
          dark: '#002B66',
          light: '#FFFFFF'
        }
      });
      this.ticketQrDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Error generating QR:', err);
    }
  }

  closeTicketQrModal(): void {
    this.selectedTicketForQr.set(null);
    this.ticketQrDataUrl.set('');
  }
}
