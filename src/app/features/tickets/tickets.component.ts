import { Component, inject, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import * as QRCode from 'qrcode';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { TicketItem } from '../../core/models/ticket.model';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './tickets.component.html'
})
export class TicketsComponent implements OnInit, OnDestroy {
  eventService = inject(EventService);
  authService = inject(AuthService);
  route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  qrDataUrls: { [ticketId: string]: string } = {};
  
  // Cancel Ticket Modal state (Bottom sheet on mobile, modal on desktop)
  ticketToCancel = signal<TicketItem | null>(null);
  showCancelModal = signal<boolean>(false);
  cancelSuccessNotice = signal<string>('');

  private checkInListener: any = null;

  get userTickets(): TicketItem[] {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'MAHASISWA') return [];
    const all = this.eventService.tickets().filter(t => 
      t.userId === user.id || 
      (user.nim && t.userNim === user.nim)
    );
    
    // Check if route has :ticket_code parameter
    const paramCode = this.route.snapshot.paramMap.get('ticket_code');
    if (paramCode) {
      const match = all.filter(t => t.ticketCode.toLowerCase() === paramCode.toLowerCase());
      if (match.length > 0) return match;
    }
    return all;
  }

  ngOnInit(): void {
    this.generateAllQrCodes();

    // Listen for real-time check-in events (from scanner / panitia / another device)
    if (typeof window !== 'undefined') {
      this.checkInListener = (e: any) => {
        const detail = e.detail;
        this.cancelSuccessNotice.set(`✓ Barcode Berhasil Di-scan! Tiket ${detail?.ticketCode || ''} tercatat HADIR dan E-Sertifikat resmi telah aktif.`);
        this.generateAllQrCodes();
        this.cdr.markForCheck();
        setTimeout(() => this.cancelSuccessNotice.set(''), 6000);
      };
      window.addEventListener('uii-ticket-checked-in', this.checkInListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.checkInListener) {
      window.removeEventListener('uii-ticket-checked-in', this.checkInListener);
    }
  }

  async generateAllQrCodes(): Promise<void> {
    for (const ticket of this.userTickets) {
      if (!this.qrDataUrls[ticket.id]) {
        try {
          const url = await QRCode.toDataURL(ticket.qrPayload, {
            margin: 1,
            width: 280,
            color: {
              dark: '#002B66',
              light: '#FFFFFF'
            }
          });
          this.qrDataUrls[ticket.id] = url;
          this.cdr.markForCheck();
        } catch (err) {
          console.error('Failed to generate QR for ticket:', ticket.ticketCode, err);
        }
      }
    }
  }

  openCancelModal(ticket: TicketItem): void {
    this.ticketToCancel.set(ticket);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.ticketToCancel.set(null);
    this.showCancelModal.set(false);
  }

  confirmCancelTicket(): void {
    const ticket = this.ticketToCancel();
    if (ticket) {
      this.eventService.cancelRegistration(ticket.id);
      this.cancelSuccessNotice.set(`Pendaftaran untuk ${ticket.eventTitle} berhasil dibatalkan. Kuota telah dikembalikan.`);
      this.closeCancelModal();
      setTimeout(() => this.cancelSuccessNotice.set(''), 4000);
    }
  }

  checkInTicket(ticket: TicketItem): void {
    const cert = this.eventService.checkInAndUnlockCertificate(ticket.id);
    if (cert) {
      this.cancelSuccessNotice.set(`✓ Presensi Berhasil! Anda tercatat HADIR dan E-Sertifikat resmi serta ${cert.skpiPoints} Poin SKPI telah aktif.`);
      setTimeout(() => this.cancelSuccessNotice.set(''), 6000);
    }
  }

  downloadTicketPdf(ticket: TicketItem): void {
    window.print();
  }

  addToGoogleCalendar(ticket: TicketItem): void {
    const title = encodeURIComponent(ticket.eventTitle);
    const details = encodeURIComponent(`E-Tiket UII: ${ticket.ticketCode}\nRuang: ${ticket.eventRoom}\nLokasi: ${ticket.eventLocation}`);
    const location = encodeURIComponent(`${ticket.eventRoom}, ${ticket.eventLocation}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(url, '_blank');
  }
}
