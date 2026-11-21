import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import * as QRCode from 'qrcode';
import { EventService } from '../../core/services/event.service';
import { AuthService } from '../../core/services/auth.service';
import { CertificateItem, TicketItem } from '../../core/models/ticket.model';

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './certificates.component.html'
})
export class CertificatesComponent implements OnInit {
  eventService = inject(EventService);
  authService = inject(AuthService);
  route = inject(ActivatedRoute);

  selectedCert = signal<CertificateItem | null>(null);
  certQrDataUrl = signal<string>('');
  unlockSuccessNotice = signal<string>('');

  get userTickets(): TicketItem[] {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'MAHASISWA') return [];
    return this.eventService.tickets().filter(t => 
      t.userId === user.id || (user.nim && t.userNim === user.nim)
    );
  }

  get userCertificates(): CertificateItem[] {
    const user = this.authService.currentUser();
    if (!user || user.role !== 'MAHASISWA') return [];
    return this.eventService.certificates().filter(c => 
      c.userId === user.id || (user.nim && c.userNim === user.nim)
    );
  }

  get formattedStudyProgram(): string {
    const cert = this.selectedCert();
    if (!cert) return '';
    const prodi = cert.userStudyProgram || '';
    const faculty = cert.userFaculty || '';
    if (prodi.includes(faculty)) return prodi;
    return faculty ? `${prodi} - ${faculty}` : prodi;
  }

  get userPasses(): { ticket: TicketItem; certificate?: CertificateItem }[] {
    return this.userTickets.map(ticket => {
      const certificate = this.userCertificates.find(c => c.ticketId === ticket.id || c.eventId === ticket.eventId);
      return { ticket, certificate };
    });
  }

  get totalSkpiPoints(): number {
    return this.userCertificates.reduce((sum, c) => sum + (c.skpiPoints || 0), 0);
  }

  ngOnInit(): void {
    // 1. Auto-issue certificates for any tickets already marked attended
    for (const ticket of this.userTickets) {
      if (ticket.isCheckedIn) {
        this.eventService.issueCertificateForTicket(ticket);
      }
    }

    // Check if route has :id param
    const paramId = this.route.snapshot.paramMap.get('id');
    if (paramId) {
      const match = this.userCertificates.find(c => 
        c.id === paramId || 
        c.ticketId === paramId || 
        c.certificateNumber.includes(paramId) ||
        c.eventId === paramId
      );
      if (match) {
        this.selectCertificate(match);
        return;
      }
    }
    // Default select first available certificate
    if (this.userCertificates.length > 0) {
      this.selectCertificate(this.userCertificates[0]);
    }
  }

  unlockAndDownload(ticket: TicketItem): void {
    const cert = this.eventService.checkInAndUnlockCertificate(ticket.id);
    if (cert) {
      this.unlockSuccessNotice.set(`Presensi Hadir Berhasil! E-Sertifikat resmi dan ${cert.skpiPoints} Poin SKPI untuk "${cert.eventTitle}" telah aktif dan siap diunduh.`);
      this.selectCertificate(cert);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      setTimeout(() => {
        this.unlockSuccessNotice.set('');
      }, 6000);
    }
  }

  async selectCertificate(cert: CertificateItem): Promise<void> {
    this.selectedCert.set(cert);
    try {
      const verifyUrl = `${window.location.origin}/verify/${cert.verificationHash}`;
      const url = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 140,
        color: {
          dark: '#002B66',
          light: '#FFFFFF'
        }
      });
      this.certQrDataUrl.set(url);
    } catch (e) {
      console.error('Error generating cert QR:', e);
    }
  }

  printCertificate(): void {
    window.print();
  }
}
