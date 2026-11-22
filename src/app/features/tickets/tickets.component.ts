import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
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
export class TicketsComponent implements OnInit {
  eventService = inject(EventService);
  authService = inject(AuthService);
  route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  qrDataUrls: { [ticketId: string]: string } = {};
  
  // Cancel Ticket Modal state (Bottom sheet on mobile, modal on desktop)
  ticketToCancel = signal<TicketItem | null>(null);
  showCancelModal = signal<boolean>(false);
  cancelSuccessNotice = signal<string>('');

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

  async ngOnInit(): Promise<void> {
    await this.eventService.loadMyTickets();
    await this.generateAllQrCodes();
  }

  async generateAllQrCodes(): Promise<void> {
    for (const ticket of this.userTickets) {
      if (!this.qrDataUrls[ticket.id]) {
        try {
          const payloadToEncode = ticket.qrPayload || ticket.ticketCode;
          if (!payloadToEncode) continue;
          const url = await QRCode.toDataURL(payloadToEncode, {
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

  async confirmCancelTicket(): Promise<void> {
    const ticket = this.ticketToCancel();
    if (ticket) {
      await this.eventService.cancelRegistrationReal(ticket.ticketCode);
      this.cancelSuccessNotice.set(`Pendaftaran untuk ${ticket.eventTitle} berhasil dibatalkan. Kuota telah dikembalikan.`);
      this.closeCancelModal();
      await this.generateAllQrCodes();
      setTimeout(() => this.cancelSuccessNotice.set(''), 4000);
    }
  }

  async checkInTicket(ticket: TicketItem): Promise<void> {
    const res = await this.eventService.processScanReal(ticket.ticketCode);
    if (res.status === 'SUCCESS' || res.status === 'DUPLICATE') {
      await this.eventService.loadMyTickets();
      await this.eventService.loadMyCertificates();
      await this.generateAllQrCodes();
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
